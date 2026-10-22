// End-to-end check against real services, for the viaSocket dashboard's test user. The test connection is
// read back at run time (never written into product code), exactly as a real user's would be after Connect.
//   npm run verify -- gmail            (or slack_dm, slack_channel, discord_channel, discord_dm, outlook)
import { fileURLToPath } from 'node:url'
process.env.TECHPULSE_DB ||= fileURLToPath(new URL('../data/verify-db.json', import.meta.url))
const { viasocket, serviceIdFor } = await import('../src/viasocket.js')
const { putUser, getUser, load, userEvents } = await import('../src/store.js')
const { pollSources, processUser, deliverDigest } = await import('../src/pipeline.js')
const { channelById } = await import('../src/config.js')
const { options } = await import('../src/delivery.js')

const TEST_USER = 'apps-api-test-user'
const channelId = process.argv[2] || 'gmail'
const channel = channelById(channelId)
const serviceId = await serviceIdFor(channel.app)
const conn = (await viasocket.user(TEST_USER).listConnections()).find((c) => c.id.endsWith('_' + serviceId) && !c.isExpired)
if (!conn) throw new Error(`No ${channel.app} test connection for ${TEST_USER}: connect one in the viaSocket dashboard first`)
const label = Object.values(JSON.parse(conn.connection_label || '{}')).join(', ')
console.log(`test connection: ${channel.app} (${label})`)

const fields = {}
for (const p of channel.pick || []) {
  const { options: opts } = await options({ id: TEST_USER, connections: { [channel.app]: { authId: conn.id } } }, channel.id, p.key)
  console.log(`options for ${p.key}: ${opts.length} (first: ${opts.slice(0, 3).map((o) => o.label).join(', ')})`)
  const want = process.env.VERIFY_PICK && opts.find((o) => o.label.toLowerCase().includes(process.env.VERIFY_PICK.toLowerCase()))
  const chosen = want || opts[0]
  fields[p.key] = p.multi ? [chosen.value] : chosen.value
  console.log(`  using: ${chosen.label}`)
}
for (const a of channel.ask || []) fields[a.key] = process.env.VERIFY_EMAIL || label.match(/[^\s,]+@[^\s,]+/)?.[0]

const user = getUser(TEST_USER) || {
  id: TEST_USER,
  createdAt: new Date().toISOString(),
  onboarded: true,
  profile: { tags: ['llms', 'open-source', 'agents', 'dev-tools'], companies: ['anthropic', 'openai'], frequency: 'daily', learningMode: true },
  connections: {}
}
user.connections = { ...user.connections, [channel.app]: { authId: conn.id, label } }
user.delivery = { channel: channel.id, fields, ready: true }
putUser(user)

const polled = await pollSources()
console.log(`polled: ${polled.newItems} new items, ${polled.newEvents.length} new events`)
console.log('sources:', JSON.stringify(load().sourceStatus))
const r = await processUser(getUser(TEST_USER))
console.log('relevance:', r)
const seen = userEvents(TEST_USER)
for (const [id, s] of Object.entries(seen)) console.log(`  [${s.status}${s.mode ? '/' + s.mode : ''}] ${s.ai ? `${s.ai.relevance} ${s.ai.major ? 'MAJOR ' : ''}${s.ai.headline}` : load().events[id].title + ' — ' + s.reason}`)
const d = await deliverDigest(getUser(TEST_USER), 'daily')
console.log(`digest: ${d.sent} items sent; first runAction result:`, JSON.stringify(d.result?.[0])?.slice(0, 600))
console.log('deliveries:', JSON.stringify(load().deliveries.slice(0, 5), null, 1))
