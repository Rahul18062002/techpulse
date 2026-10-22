// Hacker News through the public Algolia API: current front-page stories plus fresh, already-popular ones.
export async function poll(cfg) {
  const since = Math.floor(Date.now() / 1000) - 36 * 3600
  const urls = [
    `https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=${cfg.hitsPerPage}`,
    `https://hn.algolia.com/api/v1/search_by_date?tags=story&numericFilters=points>${cfg.minPoints},created_at_i>${since}&hitsPerPage=${cfg.hitsPerPage}`
  ]
  const byId = new Map()
  for (const url of urls) {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) })
    if (!res.ok) throw new Error(`Hacker News answered ${res.status}`)
    for (const hit of (await res.json()).hits) {
      if (!hit.title || (hit.points ?? 0) < cfg.minPoints) continue
      byId.set(hit.objectID, {
        id: `hn:${hit.objectID}`,
        source: 'hackernews',
        title: hit.title,
        url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
        discussionUrl: `https://news.ycombinator.com/item?id=${hit.objectID}`,
        text: (hit.story_text || '').replace(/<[^>]+>/g, ' ').slice(0, 1200),
        publishedAt: hit.created_at,
        signal: { points: hit.points, comments: hit.num_comments }
      })
    }
  }
  return [...byId.values()]
}
