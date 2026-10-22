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
test('digest timing', () => {
  const user = { profile: daily, createdAt: '2026-10-20T08:00:00' }
  assert.equal(digestDue(user, new Date('2026-10-20T08:30:00')), null)
  assert.equal(digestDue(user, new Date('2026-10-20T09:05:00')), 'daily')
  assert.equal(digestDue({ ...user, lastDigestAt: '2026-10-20T09:05:00' }, new Date('2026-10-20T20:00:00')), null)
  const weekly = { profile: { frequency: 'weekly' }, createdAt: '2026-10-14T08:00:00' } // a Wednesday
  assert.equal(digestDue(weekly, new Date('2026-10-18T10:00:00')), null) // Sunday
  assert.equal(digestDue(weekly, new Date('2026-10-19T09:30:00')), 'weekly') // Monday
})
