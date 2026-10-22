// Every source is a poller with the same shape: poll(config) → [{ id, source, title, url, text, publishedAt, signal }].
// Adding one is a file here plus an entry in config/sources.json.
import * as hackernews from './hackernews.js'
import * as arxiv from './arxiv.js'
import * as github from './github.js'

export const pollers = { hackernews, arxiv, github }
