import express from 'express'
import { randomUUID } from 'node:crypto'
import { viasocket, serviceIdFor } from './src/viasocket.js'
import { interests, delivery, engine, channelById, allowedApps, tagById, companyById } from './src/config.js'
import { load, save, getUser, putUser, userEvents } from './src/store.js'
import { ensureEnabled, options, send } from './src/delivery.js'
import { runCycle, runDigests, processUser, deliverDigest, pollSources } from './src/pipeline.js'
import { digestMessage } from './src/format.js'

const app = express()
app.use(express.json())
app.use(express.static('public'))
app.use('/vendor/viasocket-apps', express.static('node_modules/viasocket-apps/dist/esm'))

// Login is out of scope for this demo: each browser gets a stable id in a cookie, which stands in for the
// logged-in user. It is the product's own id for the user, never the email.
app.use((req, res, next) => {
  let id = (req.headers.cookie || '').match(/tp_uid=([\w-]+)/)?.[1]
  if (!id) {
    id = `u-${randomUUID()}`
    res.setHeader('Set-Cookie', `tp_uid=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`)
  }
  req.userId = id
  next()
})

const FREQ_TEXT = {
  instant: 'You’ll get major launches the moment they happen, and everything else in a short daily digest.',
  daily: `You’ll get one digest a day, around ${engine.digestHour}:00. Truly major launches still arrive right away.`,
  weekly: 'You’ll get one roundup a week, on Monday morning. Truly major launches still arrive right away.'
}

function currentUser(req) {
  return getUser(req.userId) || {
    id: req.userId,
    createdAt: new Date().toISOString(),
    onboarded: false,
    profile: { ...interests.defaults },
    connections: {},
    delivery: { channel: null, fields: {}, ready: false }
  }
}

const iconCache = {}
async function appInfo(slug) {
  if (!iconCache[slug]) {
    const v = await viasocket.catalog.versions(await serviceIdFor(slug))
    iconCache[slug] = { slug, name: delivery.apps[slug].name, icon: v?.service.icon_url }
  }
  return iconCache[slug]
}

// ---- configuration the UI renders from (no technical settings) ----
app.get('/api/catalog', async (req, res, next) => {
  try {
    res.json({
      tags: interests.tags.map(({ id, label }) => ({ id, label })),
      companies: interests.companies.map(({ id, label }) => ({ id, label })),
      frequencies: [
        { id: 'instant', label: 'Instant, for major news only', text: FREQ_TEXT.instant },
        { id: 'daily', label: 'Daily digest', text: FREQ_TEXT.daily },
        { id: 'weekly', label: 'Weekly roundup', text: FREQ_TEXT.weekly }
      ],
      apps: await Promise.all(allowedApps.map(appInfo)),
      channels: delivery.channels.map(({ id, app, label, hint, pick = [], ask = [] }) => ({ id, app, label, hint, pick, ask }))
    })
  } catch (e) { next(e) }
})

app.get('/api/me', async (req, res, next) => {
  try {
    const user = currentUser(req)
    // A connection that expired is shown as "Reconnect" and is renewed in place, keeping its auth_id.
    const expired = {}
    if (Object.keys(user.connections || {}).length) {
      const live = await viasocket.user(user.id).listConnections()
      for (const [slug, c] of Object.entries(user.connections)) {
        const found = live.find((l) => l.id === c.authId)
        expired[slug] = !found || found.isExpired === true
      }
    }
    res.json({
      onboarded: user.onboarded,
      profile: user.profile,
      delivery: user.delivery,
      connections: Object.fromEntries(Object.entries(user.connections || {}).map(([slug, c]) => [slug, { connected: true, expired: expired[slug], authId: c.authId, label: c.label }]))
    })
  } catch (e) { next(e) }
})

app.post('/api/profile', (req, res) => {
  const user = currentUser(req)
  const { tags, companies, frequency, learningMode } = req.body
  const validTags = (tags || []).filter((t) => tagById(t))
  if (!validTags.length) return res.status(400).json({ error: 'Pick at least one interest.' })
  user.profile = {
    tags: validTags,
    companies: (companies || []).filter((c) => companyById(c)),
    frequency: FREQ_TEXT[frequency] ? frequency : 'daily',
    learningMode: !!learningMode
  }
  putUser(user)
  const names = validTags.map((t) => tagById(t).label)
  const follow = user.profile.companies.map((c) => companyById(c).label)
  res.json({
    ok: true,
    message: `Saved. You’re following ${names.join(', ')}${follow.length ? `, and keeping a close eye on ${follow.join(', ')}` : ''}. ${FREQ_TEXT[user.profile.frequency]}${user.profile.learningMode ? ' Each item will include a short plain-language explanation.' : ''}`
  })
})

// ---- viaSocket: Connect ----
// Only the delivery apps in config/channels.json can be connected: the token endpoint refuses any other app,
// and a connection is stored only if it belongs to this user and to one of those apps.
app.get('/api/viasocket/token', async (req, res, next) => {
  try {
    const slugs = String(req.query.apps || '').split(',').filter(Boolean)
    if (slugs.some((s) => !allowedApps.includes(s))) return res.status(400).json({ error: 'That app is not available in TechPulse.' })
    const serviceIds = Object.fromEntries(await Promise.all(slugs.map(async (slug) => [slug, await serviceIdFor(slug)])))
    const actions = Object.fromEntries(slugs.map((s) => [s, [...new Set(delivery.channels.filter((c) => c.app === s).map((c) => c.action))]]))
    res.json({ token: await viasocket.user(req.userId).token(), serviceIds, actions })
  } catch (e) { next(e) }
})

app.post('/api/viasocket/connected', async (req, res, next) => {
  try {
    const { app: slug, authId } = req.body
    if (!allowedApps.includes(slug) || typeof authId !== 'string') return res.status(400).json({ error: 'Unknown app' })
    const serviceId = await serviceIdFor(slug)
    const live = await viasocket.user(req.userId).listConnections()
    const conn = live.find((c) => c.id === authId && c.service_id === serviceId)
    if (!conn) return res.status(400).json({ error: 'That connection was not found for your account. Please try connecting again.' })
    const user = currentUser(req)
    let label = ''
    try { label = Object.values(JSON.parse(conn.connection_label || '{}')).join(', ') } catch {}
    user.connections[slug] = { ...user.connections[slug], authId, label, connectedAt: new Date().toISOString() }
    putUser(user)
    await ensureEnabled(user, slug)
    res.json({ ok: true, message: `${delivery.apps[slug].name} is connected${label ? ` (${label})` : ''}.` })
  } catch (e) { next(e) }
})

// ---- viaSocket: Pick ----
app.get('/api/options', async (req, res, next) => {
  try {
    const { options: list } = await options(currentUser(req), req.query.channel, req.query.key, req.query.q)
    res.json({ options: list.map(({ label, value }) => ({ label, value })) })
  } catch (e) { next(e) }
})

app.post('/api/delivery', (req, res) => {
  const user = currentUser(req)
  const channel = channelById(req.body.channel)
  if (!channel) return res.status(400).json({ error: 'Choose where to deliver.' })
  if (!user.connections[channel.app]) return res.status(400).json({ error: `Connect ${delivery.apps[channel.app].name} first.` })
  const fields = {}
  for (const p of channel.pick || []) {
    const v = req.body.fields?.[p.key]
    if (!v || (Array.isArray(v) && !v.length)) return res.status(400).json({ error: `Choose: ${p.label}.` })
    fields[p.key] = p.multi ? [].concat(v) : String(v)
  }
  for (const a of channel.ask || []) {
    const v = String(req.body.fields?.[a.key] || '').trim()
    if (a.type === 'email' && !/^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(v)) return res.status(400).json({ error: 'Please enter a valid email address.' })
    fields[a.key] = v
  }
  user.delivery = { channel: channel.id, fields, labels: req.body.labels || {}, ready: true }
  user.onboarded = true
  putUser(user)
  const where = Object.values(req.body.labels || {}).flat().join(', ') || Object.values(fields).flat().join(', ')
  res.json({ ok: true, message: `Done. TechPulse will deliver to ${channel.label}${where ? ` (${where})` : ''}.` })
})

// ---- viaSocket: Act ----
app.post('/api/test-message', async (req, res, next) => {
  try {
    const user = currentUser(req)
    const channel = channelById(user.delivery?.channel)
    if (!channel) return res.status(400).json({ error: 'Choose where to deliver first.' })
    const sample = [{ event: { url: 'https://github.com/', sources: ['github'] }, ai: { relevance: 100, topic: 'Welcome', headline: 'TechPulse is set up', summary: 'This is a test message. Your updates will arrive here, in this format.', why_it_matters: 'You can stop scrolling feeds: what matters to you comes to you.', concept: user.profile.learningMode ? 'A digest bundles several updates into one message so your channel stays quiet.' : '' } }]
    await send(user, digestMessage(sample, channel.format, 'test'))
    res.json({ ok: true, message: `Test sent to ${channel.label}. Check it now.` })
  } catch (e) { next(e) }
})

app.get('/api/feed', (req, res) => {
  const db = load()
  const seen = userEvents(req.userId)
  const rows = Object.entries(seen).filter(([, s]) => s.ai && s.status !== 'skipped')
    .map(([id, s]) => ({ id, status: s.status, mode: s.mode, at: s.sentAt || s.at, ...s.ai, url: db.events[id]?.url, sources: db.events[id]?.sources }))
    .sort((a, b) => b.relevance - a.relevance)
  const deliveries = db.deliveries.filter((d) => d.userId === req.userId).slice(0, 20).map(({ kind, ok, at, eventIds, detail }) => ({ kind, ok, at, count: eventIds.length, detail: ok ? undefined : 'Delivery did not go through; it will be retried with your next digest.' }))
  const sources = Object.entries(db.sourceStatus).map(([name, s]) => ({ name, ok: s.ok, at: s.at }))
  res.json({ items: rows, deliveries, sources })
})

app.post('/api/check-now', async (req, res, next) => {
  try {
    const user = getUser(req.userId)
    if (!user?.onboarded) return res.status(400).json({ error: 'Finish setup first.' })
    await pollSources()
    const r = await processUser(user)
    res.json({ ok: true, message: r.assessed ? `Checked. ${r.instant} major update${r.instant === 1 ? '' : 's'} sent now, ${r.queued} saved for your digest.` : 'Checked. Nothing new for you right now.' })
  } catch (e) { next(e) }
})

app.post('/api/digest-now', async (req, res, next) => {
  try {
    const user = getUser(req.userId)
    if (!user?.onboarded) return res.status(400).json({ error: 'Finish setup first.' })
    const r = await deliverDigest(user, user.profile.frequency === 'weekly' ? 'weekly' : 'daily')
    res.json({ ok: true, message: r.sent ? `Digest with ${r.sent} update${r.sent === 1 ? '' : 's'} sent.` : 'Nothing is waiting for your digest yet.' })
  } catch (e) { next(e) }
})

app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: 'Something went wrong on our side. Please try again in a moment.', detail: process.env.NODE_ENV === 'production' ? undefined : err.message })
})

const port = process.env.PORT || 3000
app.listen(port, () => console.log(`TechPulse on http://localhost:${port}`))

if (process.env.TECHPULSE_SCHEDULER !== 'off') {
  const safe = (fn) => () => fn().catch((e) => console.error('[scheduler]', e.message))
  setTimeout(safe(runCycle), 5000)
  setInterval(safe(runCycle), engine.pollEveryMinutes * 60000)
  setInterval(safe(runDigests), engine.digestCheckEveryMinutes * 60000)
}
