// Delivery through viaSocket only: the user's own connection (auth_id), enabled once into a script_id,
// then one action run per message. No Slack/Discord/email client or token lives in this product.
import { viasocket, serviceIdFor } from './viasocket.js'
import { channelById } from './config.js'
import { putUser } from './store.js'

export const deepSet = (obj, path, value) => {
  const keys = path.split('.')
  let o = obj
  for (const k of keys.slice(0, -1)) o = o[k] ??= {}
  o[keys.at(-1)] = value
  return obj
}

/** The script_id for this user and app: enabled once, resumed if paused, never enabled twice. */
export async function ensureEnabled(user, app) {
  const conn = user.connections?.[app]
  if (!conn?.authId) throw new Error(`Connect ${app} first`)
  const serviceId = await serviceIdFor(app)
  const vsUser = viasocket.user(user.id)
  let scriptId = conn.scriptId || (await vsUser.findEnabled(serviceId))
  if (scriptId) {
    const flow = (await vsUser.listFlows()).find((f) => f.id === scriptId)
    if (!flow || flow.status === 'deleted') scriptId = null
    else if (flow.status === 'paused') await vsUser.setFlowStatus(scriptId, 1)
  }
  if (!scriptId) scriptId = (await vsUser.enable(serviceId, conn.authId)).scriptId
  if (conn.scriptId !== scriptId) {
    conn.scriptId = scriptId
    putUser(user)
  }
  return scriptId
}

/**
 * inputData per channel. Where each key comes from:
 *  - picked by the user on screen (PICK keys, and the email address): user.delivery.fields
 *  - per message, from the product's AI summary: the text / subject / body
 *  - constants, right for every user: sender name, no @everyone, no TTS, no link previews, send now
 * Keys not listed are left out on purpose (threads, CC/BCC, attachments, labels, scheduling, buttons, custom headers).
 */
function buildInput(channel, fields, msg, { important }) {
  const input = structuredClone(channel.base || {})
  for (const [k, v] of Object.entries(fields || {})) deepSet(input, k, v)
  switch (channel.app) {
    case 'slack':
      return { ...input, markdown_content: msg.body, bot_details: { bot_name: 'TechPulse' }, preview: { unfurl_links: false, unfurl_media: false } }
    case 'discord':
      return channel.id === 'discord_dm'
        ? { ...input, message_content: msg.body, mention_everyone: false, tts: false }
        : { ...input, message_content: msg.body, mention_everyone: false, tts: false, bot_name: 'TechPulse' }
    case 'gmail':
      // `from` (PICK) is left out: the email goes from the account the user connected.
      return { ...input, subject: msg.subject, messageBody: msg.body, fromName: 'TechPulse' }
    case 'microsoft-outlook':
      return { ...input, subject: msg.subject, body: msg.body, importance: important ? 'High' : 'Normal' }
  }
  throw new Error(`No delivery for app ${channel.app}`)
}

export function isFailure(out) {
  if (out && typeof out === 'object') {
    if (typeof out.success === 'boolean' && 'data' in out) return !out.success
    if (out.success === false) return true
  }
  return false
}

/** Sends one or more messages (a digest may be split) to the user's chosen channel. */
export async function send(user, messages, opts = {}) {
  const channel = channelById(user.delivery?.channel)
  if (!channel) throw new Error('Choose where to deliver first')
  const scriptId = await ensureEnabled(user, channel.app)
  const actionVersionId = await viasocket.catalog.versionIdFor(await serviceIdFor(channel.app), channel.action, channel.version)
  const results = []
  for (const msg of messages) {
    const out = await viasocket.runAction(scriptId, actionVersionId, buildInput(channel, user.delivery.fields, msg, opts))
    if (isFailure(out)) throw Object.assign(new Error(out.message || out.data?.message || 'The app refused the message'), { result: out })
    results.push(out)
  }
  return results
}

/** Options for one PICK key of the user's chosen channel, scoped by what is chosen so far. */
export async function options(user, channelId, fieldKey, searchText) {
  const channel = channelById(channelId)
  if (!channel?.pick?.some((p) => p.key === fieldKey)) throw new Error('Unknown field')
  const authId = user.connections?.[channel.app]?.authId
  if (!authId) throw new Error(`Connect ${channel.app} first`)
  const actionVersionId = await viasocket.catalog.versionIdFor(await serviceIdFor(channel.app), channel.action, channel.version)
  const existingFields = structuredClone(channel.base || {})
  if (searchText) existingFields._searchText = searchText
  return viasocket.user(user.id).listOptions(actionVersionId, { fieldKey, authId, existingFields })
}
