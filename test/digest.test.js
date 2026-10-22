import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.VIASOCKET_ORG_ID ||= 'test'; process.env.VIASOCKET_PROJECT_ID ||= 'test'; process.env.VIASOCKET_EMBED_SECRET ||= 'test'
const { digestMessage } = await import('../src/format.js')

const entries = Array.from({ length: 25 }, (_, i) => ({
  event: { url: `https://example.com/story-${i}`, sources: ['hackernews'] },
  ai: {
    relevance: 90 - i, topic: ['LLMs', 'AI agents', 'Research papers'][i % 3], headline: `Story number ${i} about something new in AI`,
    summary: 'A plain-language sentence about what happened, long enough to look like a real summary of a real story.',
    why_it_matters: 'One sentence on why this reader should care about it today.', concept: ''
  }
}))

for (const style of ['slack', 'discord', 'email']) {
  test(`${style}: every item is in the digest, the top ones in full, and no message breaks the platform cap`, () => {
    const parts = digestMessage(entries, style, 'daily', 6)
    const all = parts.map((p) => p.body).join('\n')
    for (const e of entries) assert.ok(all.includes(e.event.url), `missing ${e.event.url}`)
    assert.equal(all.split('Why it matters').length - 1, 6)
    assert.ok(all.includes('Also worth a look') || all.includes('ALSO WORTH A LOOK'))
    const cap = { slack: 4000, discord: 2000, email: Infinity }[style]
    for (const p of parts) assert.ok(p.body.length <= cap, `${p.body.length} > ${cap}`)
  })
}

test('a small digest has no quick list', () => {
  const [msg] = digestMessage(entries.slice(0, 3), 'slack', 'daily', 6)
  assert.ok(!msg.body.includes('ALSO WORTH A LOOK'))
})
