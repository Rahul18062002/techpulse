// Plain-language messages for each channel family. No raw source metadata, one link per item.
const SOURCE_NAMES = { hackernews: 'Hacker News', arxiv: 'arXiv', github: 'GitHub' }
const esc = (s = '') => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const alsoOn = (ev) => (ev.sources.length > 1 ? ` (also on ${ev.sources.slice(1).map((s) => SOURCE_NAMES[s]).join(', ')})` : '')

function itemText(entry, style) {
  const { headline, summary, why_it_matters: why, concept } = entry.ai
  const link = entry.event.url
  const src = SOURCE_NAMES[entry.event.sources[0]] + alsoOn(entry.event)
  if (style === 'slack')
    return [`*${headline}*`, summary, `_Why it matters:_ ${why}`, concept && `:bulb: ${concept}`, `${src}: ${link}`].filter(Boolean).join('\n')
  if (style === 'discord')
    return [`**${headline}**`, summary, `*Why it matters:* ${why}`, concept && `💡 ${concept}`, `${src}: <${link}>`].filter(Boolean).join('\n')
  return `<h3 style="margin:16px 0 4px;font-size:16px">${esc(headline)}</h3>
<p style="margin:0 0 4px">${esc(summary)}</p>
<p style="margin:0 0 4px"><i>Why it matters:</i> ${esc(why)}</p>
${concept ? `<p style="margin:0 0 4px;color:#555">💡 ${esc(concept)}</p>` : ''}
<p style="margin:0"><a href="${esc(link)}">Read on ${esc(src)}</a></p>`
}

export function instantMessage(entry, style) {
  const subject = `TechPulse: ${entry.ai.headline}`
  if (style === 'email')
    return { subject, body: `<div style="font-family:system-ui,sans-serif;max-width:600px">${itemText(entry, style)}<p style="color:#888;font-size:12px;margin-top:20px">Sent right away because it's a major update that matches your interests.</p></div>` }
  const prefix = style === 'slack' ? ':zap: *TechPulse: major update*' : '⚡ **TechPulse: major update**'
  return { subject, body: `${prefix}\n${itemText(entry, style)}` }
}

export function digestMessage(entries, style, period) {
  const groups = {}
  for (const e of [...entries].sort((a, b) => b.ai.relevance - a.ai.relevance)) (groups[e.ai.topic || 'Other'] ??= []).push(e)
  const title = `Your ${period} TechPulse: ${entries.length} update${entries.length === 1 ? '' : 's'}`
  if (style === 'email') {
    const html = Object.entries(groups).map(([topic, list]) =>
      `<h2 style="font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:#666;border-bottom:1px solid #eee;padding-bottom:4px;margin-top:28px">${esc(topic)}</h2>${list.map((e) => itemText(e, style)).join('')}`).join('')
    return [{ subject: title, body: `<div style="font-family:system-ui,sans-serif;max-width:600px"><h1 style="font-size:20px">${esc(title)}</h1>${html}</div>` }]
  }
  const head = style === 'slack' ? `:newspaper: *${title}*` : `📰 **${title}**`
  const blocks = Object.entries(groups).map(([topic, list]) =>
    `${style === 'slack' ? `*${topic.toUpperCase()}*` : `__**${topic}**__`}\n\n${list.map((e) => itemText(e, style)).join('\n\n')}`)
  // Discord caps a message at 2000 characters and long Slack messages get cut up: split between items, never inside one.
  const limit = style === 'discord' ? 1900 : 3500
  const parts = []
  let current = head
  for (const block of blocks) {
    for (const piece of block.split('\n\n')) {
      if ((current + '\n\n' + piece).length > limit) { parts.push(current); current = piece } else current += '\n\n' + piece
    }
  }
  parts.push(current)
  return parts.map((body) => ({ subject: title, body }))
}
