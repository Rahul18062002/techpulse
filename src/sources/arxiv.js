// arXiv's public Atom API: the newest submissions in the configured categories.
const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
const tag = (xml, name) => decode((xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`)) || [, ''])[1].replace(/\s+/g, ' ').trim())

export async function poll(cfg) {
  const query = cfg.categories.map((c) => `cat:${c}`).join('+OR+')
  const url = `https://export.arxiv.org/api/query?search_query=${query}&sortBy=submittedDate&sortOrder=descending&max_results=${cfg.maxResults}`
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) })
  if (!res.ok) throw new Error(`arXiv answered ${res.status}`)
  const xml = await res.text()
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, entry]) => {
    const absUrl = tag(entry, 'id')
    const arxivId = absUrl.split('/abs/')[1]?.replace(/v\d+$/, '')
    const authors = [...entry.matchAll(/<name>([\s\S]*?)<\/name>/g)].map((m) => m[1].trim())
    return {
      id: `arxiv:${arxivId}`,
      source: 'arxiv',
      title: tag(entry, 'title'),
      url: `https://arxiv.org/abs/${arxivId}`,
      text: tag(entry, 'summary').slice(0, 1500),
      publishedAt: tag(entry, 'published'),
      signal: { authors: authors.slice(0, 5), categories: [...entry.matchAll(/<category term="([^"]+)"/g)].map((m) => m[1]) }
    }
  })
}
