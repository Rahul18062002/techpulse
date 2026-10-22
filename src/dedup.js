// Cross-source dedup: the same launch shows up on GitHub, Hacker News and in a paper at once. Items are grouped
// into events by strong keys (same URL, same repo + version, same arXiv id) or by overlapping key terms.
const STOP = new Set(('a an and are as at be by for from has have how in into is it its new of on or our show ask hn ' +
  'that the this to via we what when why with you your released release launches launch introducing announces now ' +
  'using use towards toward based paper vs').split(' '))

export function canonicalUrl(url = '') {
  try {
    const u = new URL(url)
    u.hash = ''
    for (const k of [...u.searchParams.keys()]) if (/^(utm_|ref$|source$)/.test(k)) u.searchParams.delete(k)
    let s = (u.host.replace(/^www\./, '') + u.pathname).replace(/\/+$/, '').toLowerCase()
    s = s.replace(/^arxiv\.org\/(abs|pdf|html)\/([\d.]+)(v\d+)?(\.pdf)?$/, 'arxiv:$2')
    return s + (u.search && !s.startsWith('arxiv:') ? u.search : '')
  } catch {
    return url
  }
}

const normVersion = (v) => v.toLowerCase().replace(/^v/, '').replace(/\.0$/, '')

/** Strong identifiers: if two items share one, they are the same event. */
export function strongKeys(item) {
  const keys = new Set()
  const url = canonicalUrl(item.url)
  if (url) keys.add(`url:${url}`)
  const blob = `${item.title} ${item.url} ${item.text?.slice(0, 300) ?? ''}`
  for (const [, id] of blob.matchAll(/arxiv\.org\/(?:abs|pdf)\/(\d{4}\.\d{4,5})/gi)) keys.add(`arxiv:${id}`)
  if (item.id.startsWith('arxiv:')) keys.add(`arxiv:${item.id.slice(6)}`)
  // repo + version, from a release or from a link/title that names both
  const repo = item.signal?.repo || (blob.match(/github\.com\/([\w.-]+\/[\w.-]+)/i) || [])[1]
  const name = repo?.split('/')[1]?.toLowerCase()
  const version = item.signal?.version || (blob.match(/\bv?(\d+\.\d+(?:\.\d+)?)\b/) || [])[1]
  if (name && version) keys.add(`release:${name}@${normVersion(version)}`)
  if (!repo && version) {
    // "Ollama 0.40.9 is out" on HN names the product before the version
    const m = item.title.match(new RegExp(`([\\w.-]+)\\s+v?${version.replace(/\./g, '\\.')}\\b`, 'i'))
    if (m) keys.add(`release:${m[1].toLowerCase()}@${normVersion(version)}`)
  }
  return [...keys]
}

// Two versions of the same product are two events, however alike their titles are.
function conflictingRelease(a, b) {
  const rel = (keys) => keys.filter((k) => k.startsWith('release:')).map((k) => k.slice(8).split('@'))
  const B = rel(b)
  return rel(a).some(([name, v]) => B.some(([n2, v2]) => n2 === name && v2 !== v))
}

export function terms(text) {
  return new Set(
    text.toLowerCase().replace(/[^a-z0-9.+\- ]/g, ' ').split(/\s+/)
      .map((w) => w.replace(/^[.\-]+|[.\-]+$/g, ''))
      .filter((w) => w.length > 1 && !STOP.has(w))
  )
}

export function similarity(a, b) {
  const A = terms(a), B = terms(b)
  if (!A.size || !B.size) return 0
  let shared = 0
  for (const t of A) if (B.has(t)) shared++
  if (shared < 2) return 0 // one common word ("beyond", "claude") is never enough to call two stories the same
  // overlap coefficient: a short HN title fully contained in a long release title counts as the same event
  return shared / Math.min(A.size, B.size) * (Math.min(A.size, B.size) >= 3 ? 1 : 0.8)
}

/**
 * Adds new items to the event list. Returns the ids of events that were created by this call.
 * An item joining an existing event never creates a second notification.
 */
export function cluster(newItems, events, { windowDays, threshold }) {
  const cutoff = Date.now() - windowDays * 864e5
  const recent = Object.values(events).filter((e) => Date.parse(e.firstSeen) >= cutoff)
  const created = []
  for (const item of newItems) {
    const keys = strongKeys(item)
    let match = recent.find((e) => e.keys.some((k) => keys.includes(k)))
    if (!match) {
      let best = 0
      for (const e of recent) {
        if (conflictingRelease(keys, e.keys)) continue
        const s = similarity(item.title, e.title)
        if (s > best) [best, match] = [s, e]
      }
      if (best < threshold) match = null
    }
    if (match) {
      match.itemIds.push(item.id)
      match.sources = [...new Set([...match.sources, item.source])]
      match.keys = [...new Set([...match.keys, ...keys])]
      match.links.push({ source: item.source, url: item.discussionUrl || item.url })
      item.eventId = match.id
      continue
    }
    const event = {
      id: `ev_${item.id.replace(/[^\w]+/g, '_')}`,
      title: item.title,
      url: item.url,
      text: item.text,
      itemIds: [item.id],
      sources: [item.source],
      links: [{ source: item.source, url: item.discussionUrl || item.url }],
      keys,
      firstSeen: new Date().toISOString(),
      publishedAt: item.publishedAt
    }
    events[event.id] = event
    recent.push(event)
    created.push(event.id)
    item.eventId = event.id
  }
  return created
}
