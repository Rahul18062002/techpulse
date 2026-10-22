// Fixture items shaped exactly like the pollers' output, covering the cross-source cases.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cluster } from '../src/dedup.js'

const opts = { windowDays: 7, threshold: 0.5 }
const gh = (repo, version) => ({ id: `gh:${repo}@v${version}`, source: 'github', title: `${repo.split('/')[1]} ${version} released`, url: `https://github.com/${repo}/releases/tag/v${version}`, text: '', signal: { repo, tag: `v${version}`, version } })
const hn = (id, title, url) => ({ id: `hn:${id}`, source: 'hackernews', title, url, discussionUrl: `https://news.ycombinator.com/item?id=${id}`, text: '' })
const ax = (id, title) => ({ id: `arxiv:${id}`, source: 'arxiv', title, url: `https://arxiv.org/abs/${id}`, text: '' })

test('a GitHub release and the HN post linking to it are one event', () => {
  const events = {}
  cluster([gh('ollama/ollama', '0.40.8')], events, opts)
  const created = cluster([hn(1, 'Ollama 0.40.8', 'https://github.com/ollama/ollama/releases/tag/v0.40.8?utm_source=hn')], events, opts)
  assert.equal(created.length, 0)
  const [ev] = Object.values(events)
  assert.deepEqual(ev.sources, ['github', 'hackernews'])
})

test('an HN post naming the product and version (no link) joins the release', () => {
  const events = {}
  cluster([gh('vllm-project/vllm', '0.32.0'), hn(2, 'vLLM 0.32.0 is out with faster speculative decoding', 'https://blog.vllm.ai/2026/10/17/v032.html')], events, opts)
  assert.equal(Object.keys(events).length, 1)
})

test('an arXiv paper and the HN thread about it (pdf link, other version) are one event', () => {
  const events = {}
  cluster([ax('2610.01234', 'Scaling Test-Time Compute for Agentic Reasoning')], events, opts)
  cluster([hn(3, 'Scaling test-time compute for agentic reasoning [pdf]', 'https://arxiv.org/pdf/2610.01234v2')], events, opts)
  assert.equal(Object.keys(events).length, 1)
})

test('the same launch covered by two HN posts with different wording is one event', () => {
  const events = {}
  cluster([hn(4, 'Meta releases Llama 5 with open weights', 'https://ai.meta.com/blog/llama-5'), hn(5, 'Llama 5: open weights from Meta', 'https://www.theverge.com/llama-5')], events, opts)
  assert.equal(Object.keys(events).length, 1)
})

test('two versions of one project stay two events', () => {
  const events = {}
  cluster([gh('run-llama/llama_index', '0.14.24'), gh('run-llama/llama_index', '0.14.25')], events, opts)
  assert.equal(Object.keys(events).length, 2)
})

test('unrelated stories stay apart', () => {
  const events = {}
  cluster([hn(6, 'Show HN: A tiny Rust database', 'https://example.com/db'), hn(7, 'Open-source robot arm for $200', 'https://example.org/arm'), gh('ollama/ollama', '0.40.8')], events, opts)
  assert.equal(Object.keys(events).length, 3)
})

test('a near-empty title sharing one word with a paper stays apart (seen live: "Beyond the &" vs "ExGrad: Beyond Suppression")', () => {
  const events = {}
  cluster([hn(8, 'Beyond the &', 'https://lwn.net/Articles/1096028/'), ax('2610.30018', 'ExGrad: Beyond Suppression - Explicit Clean-Gradient Subtraction in Adversarial Training')], events, opts)
  assert.equal(Object.keys(events).length, 2)
})

test('two HN posts with the same short product name are one event (seen live: "Claude Duet" twice)', () => {
  const events = {}
  cluster([hn(9, 'Claude Duet', 'https://claude.com/product/claude-duet'), hn(10, 'Claude Duet', 'https://claude.com/resources/articles/claude-duet')], events, opts)
  assert.equal(Object.keys(events).length, 1)
})
