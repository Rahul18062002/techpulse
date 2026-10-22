import { test } from 'node:test'
import assert from 'node:assert/strict'
// The pipeline module builds the viaSocket client on import; these tests make no calls, so placeholders do.
process.env.VIASOCKET_ORG_ID ||= 'test'; process.env.VIASOCKET_PROJECT_ID ||= 'test'; process.env.VIASOCKET_EMBED_SECRET ||= 'test'
const { decide, digestDue } = await import('../src/pipeline.js')

const daily = { frequency: 'daily' }, majorOnly = { frequency: 'instant' }

test('a confident major launch breaks through even on a daily digest', () => {
  assert.equal(decide({ relevance: 90, major: true }, daily), 'instant')
})
test('a relevant but ordinary item waits for the digest', () => {
  assert.equal(decide({ relevance: 90, major: false }, daily), 'digest')
  assert.equal(decide({ relevance: 65, major: true }, daily), 'digest')
})
test('"instant for major only" lowers the bar for major items; the rest still go to the digest', () => {
  assert.equal(decide({ relevance: 65, major: true }, majorOnly), 'instant')
  assert.equal(decide({ relevance: 65, major: false }, majorOnly), 'digest')
})
test('irrelevant items are skipped', () => {
  assert.equal(decide({ relevance: 20, major: true }, daily), 'skip')
})
test('daily digest at the chosen time, in the user\'s time zone', () => {
  const user = { createdAt: '2026-10-19T00:00:00Z', profile: { frequency: 'daily', digestTime: '18:30', timezone: 'Asia/Kolkata' } }
  // 18:30 in Kolkata is 13:00 UTC
  assert.equal(digestDue(user, new Date('2026-10-20T12:59:00Z')).key, 'daily:2026-10-19') // yesterday's slot still unsent
  const sentYesterday = { ...user, lastDigestKey: 'daily:2026-10-19' }
  assert.equal(digestDue(sentYesterday, new Date('2026-10-20T12:59:00Z')), null)
  assert.deepEqual(digestDue(sentYesterday, new Date('2026-10-20T13:01:00Z')), { period: 'daily', key: 'daily:2026-10-20' })
  assert.equal(digestDue({ ...user, lastDigestKey: 'daily:2026-10-20' }, new Date('2026-10-20T20:00:00Z')), null) // once per slot
})

test('weekly roundup on the chosen day and time', () => {
  // Friday 08:00 in New York (UTC-4 in October) = 12:00 UTC
  const user = { createdAt: '2026-10-01T00:00:00Z', lastDigestKey: 'weekly:2026-10-16', profile: { frequency: 'weekly', digestDay: 5, digestTime: '08:00', timezone: 'America/New_York' } }
  assert.equal(digestDue(user, new Date('2026-10-22T15:00:00Z')), null) // Thursday
  assert.equal(digestDue(user, new Date('2026-10-23T11:59:00Z')), null) // Friday 07:59
  assert.equal(digestDue(user, new Date('2026-10-23T12:01:00Z')).key, 'weekly:2026-10-23')
})

test('no digest for a slot from before the user signed up', () => {
  const user = { createdAt: '2026-10-20T10:00:00Z', profile: { frequency: 'daily', digestTime: '09:00', timezone: 'UTC' } }
  assert.equal(digestDue(user, new Date('2026-10-20T12:00:00Z')), null)
  assert.equal(digestDue(user, new Date('2026-10-21T09:05:00Z')).key, 'daily:2026-10-21')
})

test('schedule wording and next-digest label', async () => {
  const { scheduleText, nextDigestLabel } = await import('../src/schedule.js')
  assert.match(scheduleText({ frequency: 'weekly', digestDay: 5, digestTime: '18:30' }), /every Friday at 6:30 PM/)
  const p = { frequency: 'daily', digestTime: '09:00', timezone: 'UTC' }
  assert.equal(nextDigestLabel(p, new Date('2026-10-20T08:00:00Z')), 'Today at 9:00 AM')
  assert.equal(nextDigestLabel(p, new Date('2026-10-20T10:00:00Z')), 'Tomorrow at 9:00 AM')
  assert.equal(nextDigestLabel({ ...p, frequency: 'weekly', digestDay: 1 }, new Date('2026-10-22T10:00:00Z')), 'Monday at 9:00 AM')
})
