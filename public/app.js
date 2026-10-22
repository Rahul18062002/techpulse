import { connect, loadConnectScript } from '/vendor/viasocket-apps/browser.js'

const $ = (s, root = document) => root.querySelector(s)
const $$ = (s, root = document) => [...root.querySelectorAll(s)]
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

// ---------- icons (24px line icons) ----------
const ICONS = {
  layout: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  sparkles: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  send: '<path d="M22 2 11 13"/><path d="m22 2-7 20-4-9-9-4z"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  calendar: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8M8 13h5"/>',
  bot: '<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 4v4M9 14h.01M15 14h.01"/><circle cx="12" cy="3.5" r="1"/>',
  branch: '<circle cx="6" cy="5" r="2.5"/><circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="7" r="2.5"/><path d="M6 7.5v9M18 9.5c0 5-6 4-11.5 7"/>',
  paper: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
  robot: '<path d="M7 20h10M12 20v-6M12 14l-5-5M7 9l3-3M15 6l-5 0"/><circle cx="12" cy="14" r="1.5"/><circle cx="7" cy="9" r="1.5"/><circle cx="16" cy="6" r="2"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  code: '<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>',
  chip: '<rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>',
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4"/>',
  building: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  arrow: '<path d="M7 17 17 7M8 7h9v9"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/>',
  plug: '<path d="M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0zM12 18v4"/>'
}
const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.sparkles}</svg>`
const paintIcons = (root = document) => $$('[data-icon]', root).forEach((el) => { el.innerHTML = icon(el.dataset.icon) })

// Each topic gets its own icon and hue so the grid reads at a glance.
const TOPIC_LOOK = {
  llms: ['chat', 262], agents: ['bot', 200], 'open-source': ['branch', 150], research: ['paper', 35], robotics: ['robot', 15],
  vision: ['image', 320], safety: ['shield', 120], 'dev-tools': ['code', 225], hardware: ['chip', 45], speech: ['mic', 285]
}
const tint = (hue) => `--h: ${hue}` // colors come from .tinted in the stylesheet, per theme
const SOURCES = { hackernews: ['Hacker News', '#ff6600', 'Y'], arxiv: ['arXiv', '#b31b1b', 'aX'], github: ['GitHub', '#2f363d', 'GH'] }

// ---------- api + feedback ----------
const api = async (path, body) => {
  const res = await fetch(path, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  // detail is the server's own reason, sent only outside production: it makes a screenshot enough to diagnose
  if (!res.ok) throw new Error((data.error || 'Something went wrong') + (data.detail ? ` (${data.detail})` : ''))
  return data
}
function toast(msg, error = false) {
  const t = $('#toast')
  t.textContent = msg
  t.className = error ? 'error' : ''
  t.hidden = false
  clearTimeout(toast.timer)
  toast.timer = setTimeout(() => (t.hidden = true), 9000)
}
async function busy(btn, fn) {
  btn.disabled = true
  try { await fn() } catch (e) { toast(e.message, true) } finally { btn.disabled = false }
}

// ---------- state ----------
let catalog, me, embed
const state = { tags: new Set(), companies: new Set(), frequency: 'daily', digestTime: '09:00', digestDay: 1, learning: false, channel: null, fields: {}, labels: {}, app: null, feedTab: 'queued' }
const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

const HEAD = {
  briefing: ['Your briefing', 'What’s new for you', 'Stories picked for your interests, and what is on its way to you.'],
  interests: ['Step 1 · Interests', 'What should we watch?', 'Pick the topics you care about. We read Hacker News, new research papers and GitHub releases, and keep only what matches.'],
  schedule: ['Step 2 · Schedule', 'When should we reach you?', 'Choose how often updates arrive. Big launches can always come right away.'],
  delivery: ['Step 3 · Delivery', 'Where should it go?', 'Connect the app you already use. We never see your password; the connection is handled securely by viaSocket.']
}

// ---------- time helpers (browser-local, which is the user's time zone) ----------
const fmtTime = (t) => { const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}` }
function nextLabel() {
  const now = new Date()
  const [h, m] = state.digestTime.split(':').map(Number)
  const weekly = state.frequency === 'weekly'
  const mins = now.getHours() * 60 + now.getMinutes()
  let ahead = weekly ? (state.digestDay - now.getDay() + 7) % 7 : 0
  if (ahead === 0 && mins >= h * 60 + m) ahead = weekly ? 7 : 1
  const when = ahead === 0 ? 'Today' : ahead === 1 ? 'Tomorrow' : catalog.weekdays[(now.getDay() + ahead) % 7]
  return `${when} at ${fmtTime(state.digestTime)}`
}

// ---------- navigation ----------
function show(view) {
  if (view === 'briefing' && !me.onboarded) view = 'interests'
  for (const p of $$('.page')) p.hidden = p.dataset.page !== view
  for (const b of $$('#nav button')) b.classList.toggle('on', b.dataset.view === view)
  const [eyebrow, title, lede] = HEAD[view]
  $('#eyebrow').textContent = me.onboarded && view !== 'briefing' ? 'Settings' : eyebrow
  $('#title').textContent = title
  $('#lede').textContent = lede
  $('#top-actions').innerHTML = ''
  if (view === 'briefing') {
    $('#top-actions').innerHTML = `<button class="btn ghost" id="check">${icon('refresh')}Check for news now</button><button class="btn primary" id="digest">${icon('send')}Send my digest now</button>`
    $('#check').onclick = (e) => busy(e.currentTarget, async () => { toast('Checking sources… this can take a minute.'); toast((await api('/api/check-now', {})).message); await renderBriefing() })
    $('#digest').onclick = (e) => busy(e.currentTarget, async () => { toast((await api('/api/digest-now', {})).message); await renderBriefing() })
    renderBriefing().catch((e) => toast(e.message, true))
  }
  for (const b of $$('[data-save]')) b.textContent = me.onboarded ? 'Save changes' : b.dataset.save === 'delivery' ? 'Finish setup' : 'Continue'
  location.hash = view
  window.scrollTo({ top: 0 })
}
function renderNav() {
  $('#nav [data-view=briefing]').hidden = !me.onboarded
  $('#nav [data-view=interests]').classList.toggle('done', me.profile.tags.length > 0 && (me.onboarded || !!me.saved?.interests))
  $('#nav [data-view=schedule]').classList.toggle('done', me.onboarded || !!me.saved?.schedule)
  $('#nav [data-view=delivery]').classList.toggle('done', !!me.delivery?.ready)
  const ch = catalog.channels.find((c) => c.id === me.delivery?.channel)
  $('#side-card').innerHTML = me.onboarded
    ? `<b>${esc(me.schedule?.next || '')}</b>Next digest${ch ? ` · ${esc(ch.label)}` : ''}<div class="dot-row">${icon('globe')}<span>${esc(TZ.replace(/_/g, ' '))}</span></div>`
    : `<b>Three quick steps</b>Pick topics, choose a schedule, connect where you want updates.`
}

// ---------- interests ----------
function renderInterests() {
  $('#tags').innerHTML = catalog.tags.map((t) => {
    const [ico, hue] = TOPIC_LOOK[t.id] || ['sparkles', 40]
    return `<button class="topic-tile" data-tag="${t.id}" aria-pressed="${state.tags.has(t.id)}"><span class="t-ico tinted" style="${tint(hue)}">${icon(ico)}</span><b>${esc(t.label)}</b><span class="tick">${icon('check')}</span></button>`
  }).join('')
  $('#companies').innerHTML = catalog.companies.map((c) =>
    `<button class="company" data-company="${c.id}" aria-pressed="${state.companies.has(c.id)}"><span class="mono">${esc(c.label.replace(/[^A-Za-z]/g, '').slice(0, 2))}</span>${esc(c.label)}</button>`).join('')
  const count = () => ($('#tag-count').textContent = `${state.tags.size} selected`)
  for (const b of $$('[data-tag]')) b.onclick = () => { const id = b.dataset.tag; state.tags.has(id) ? state.tags.delete(id) : state.tags.add(id); b.setAttribute('aria-pressed', state.tags.has(id)); count() }
  for (const b of $$('[data-company]')) b.onclick = () => { const id = b.dataset.company; state.companies.has(id) ? state.companies.delete(id) : state.companies.add(id); b.setAttribute('aria-pressed', state.companies.has(id)) }
  $('#learning').checked = state.learning
  $('#learning').onchange = (e) => (state.learning = e.target.checked)
  count()
}

// ---------- schedule ----------
const FREQ_ART = { instant: 'bolt', daily: 'sun', weekly: 'calendar' }
const QUICK = [['07:00', 'Early'], ['09:00', 'Morning'], ['13:00', 'After lunch'], ['18:00', 'Evening'], ['21:00', 'Night']]
function renderSchedule() {
  $('#freq').innerHTML = catalog.frequencies.map((f) =>
    `<button class="freq" role="radio" data-freq="${f.id}" aria-checked="${state.frequency === f.id}"><span class="freq-art">${icon(FREQ_ART[f.id])}</span><b>${esc(f.label)}</b><span>${esc(f.blurb)}</span><span class="radio"></span></button>`).join('')
  for (const b of $$('[data-freq]')) b.onclick = () => { state.frequency = b.dataset.freq; renderSchedule() }

  const weekly = state.frequency === 'weekly'
  $('#when-title').textContent = state.frequency === 'instant' ? 'When should the rest arrive?' : weekly ? 'Pick a day and time' : 'Pick a time'
  $('#tz-note').innerHTML = `${icon('globe')} Your time zone: ${esc(TZ.replace(/_/g, ' '))}`
  $('#day-row').hidden = !weekly
  $('#days').innerHTML = [1, 2, 3, 4, 5, 6, 0].map((d) =>
    `<button class="day" data-day="${d}" aria-pressed="${state.digestDay === d}">${catalog.weekdays[d].slice(0, 3)}</button>`).join('')
  for (const b of $$('[data-day]')) b.onclick = () => { state.digestDay = +b.dataset.day; renderSchedule() }

  $('#quick-times').innerHTML = QUICK.map(([t, name]) =>
    `<button data-time="${t}" aria-pressed="${state.digestTime === t}">${fmtTime(t)}<small>${name}</small></button>`).join('')
  for (const b of $$('[data-time]')) b.onclick = () => { state.digestTime = b.dataset.time; renderSchedule() }
  const sel = $('#time')
  sel.innerHTML = Array.from({ length: 48 }, (_, i) => {
    const t = `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`
    return `<option value="${t}" ${t === state.digestTime ? 'selected' : ''}>${fmtTime(t)}</option>`
  }).join('')
  sel.onchange = () => { state.digestTime = sel.value; renderSchedule() }

  const what = state.frequency === 'instant' ? 'Major news arrives right away; the rest comes' : weekly ? 'Your roundup arrives' : 'Your digest arrives'
  const every = weekly ? `every ${catalog.weekdays[state.digestDay]} at ${fmtTime(state.digestTime)}` : `every day at ${fmtTime(state.digestTime)}`
  $('#preview-text').innerHTML = `${what} <b>${every}</b>. Next one: <b>${esc(nextLabel())}</b>.`
}

// ---------- delivery ----------
const appIcon = (app, size = 30) => `<img src="${esc(app.icon)}" alt="" width="${size}" height="${size}" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'badge',textContent:'${esc(app.name[0])}'}))">`
function renderApps() {
  $('#apps').innerHTML = catalog.apps.map((app) => {
    const c = me.connections[app.slug]
    const stateText = !c ? '<span class="app-state">Not connected</span>' : c.expired ? '<span class="app-state exp">Needs reconnecting</span>' : `<span class="app-state ok">Connected${c.label ? ` · ${esc(c.label)}` : ''}</span>`
    const label = !c ? `Connect ${esc(app.name)}` : c.expired ? 'Reconnect' : state.app === app.slug ? 'Selected' : `Use ${esc(app.name)}`
    return `<div class="app-tile ${state.app === app.slug ? 'on' : ''}"><span class="app-logo">${appIcon(app)}</span><div><b>${esc(app.name)}</b><br>${stateText}</div><button class="btn ${c && !c.expired ? 'ghost' : 'primary'}" data-app="${app.slug}">${!c || c.expired ? icon('plug') : ''}${label}</button></div>`
  }).join('')
  for (const b of $$('[data-app]')) {
    const slug = b.dataset.app, c = me.connections[slug]
    b.onclick = () => (c && !c.expired ? chooseApp(slug) : connectApp(slug, c?.expired ? c.authId : undefined, b))
  }
}

async function connectApp(slug, authId, btn) {
  const save = async (id) => {
    const r = await api('/api/viasocket/connected', { app: slug, authId: id })
    toast(r.message)
    me = await api('/api/me')
    chooseApp(slug)
  }
  btn.disabled = true
  try {
    // the popup opens straight from this click: the token was fetched on page load
    const { authId: id } = await connect({
      embedToken: embed.token, serviceId: embed.serviceIds[slug], actions: embed.actions[slug], skipActionSelection: true,
      ...(authId ? { authId } : {}),
      onLateSuccess: ({ authId }) => save(authId).catch((e) => toast(e.message, true))
    })
    await save(id)
  } catch (e) {
    if (e.code !== 'closed') toast(e.message, true)
  } finally { btn.disabled = false }
}

function chooseApp(slug) {
  state.app = slug
  renderApps()
  const list = catalog.channels.filter((c) => c.app === slug)
  $('#channel-box').hidden = false
  if (!list.some((c) => c.id === state.channel)) selectChannel(list[0].id)
  else renderChannels()
}
function renderChannels() {
  const list = catalog.channels.filter((c) => c.app === state.app)
  $('#channels').innerHTML = list.map((c) =>
    `<button class="channel" role="radio" data-channel="${c.id}" aria-checked="${state.channel === c.id}"><span class="radio"></span><span><b>${esc(c.label)}</b><span>${esc(c.hint)}</span></span></button>`).join('')
  for (const b of $$('[data-channel]')) b.onclick = () => selectChannel(b.dataset.channel)
  renderFields()
}
function selectChannel(id) {
  if (state.channel !== id) { state.fields = {}; state.labels = {} }
  state.channel = id
  renderChannels()
}
function renderFields() {
  const ch = catalog.channels.find((c) => c.id === state.channel)
  const box = $('#fields')
  box.innerHTML = ''
  for (const a of ch.ask) {
    const f = document.createElement('div')
    f.className = 'field'
    f.innerHTML = `<label>${esc(a.label)}</label><input class="input" type="email" placeholder="you@example.com" value="${esc(state.fields[a.key] || '')}">`
    f.querySelector('input').oninput = (e) => (state.fields[a.key] = e.target.value)
    box.append(f)
  }
  for (const p of ch.pick) {
    const f = document.createElement('div')
    f.className = 'field'
    f.innerHTML = `<label>${esc(p.label)}</label><input class="input" type="search" placeholder="Search…"><select ${p.multi ? 'multiple' : ''}><option disabled>Loading…</option></select>`
    const search = f.querySelector('input'), select = f.querySelector('select')
    const load = async (q = '') => {
      try {
        const { options } = await api(`/api/options?channel=${ch.id}&key=${encodeURIComponent(p.key)}&q=${encodeURIComponent(q)}`)
        const chosen = [].concat(state.fields[p.key] || [])
        select.innerHTML = options.length
          ? (p.multi ? '' : '<option value="">Choose…</option>') + options.map((o) => `<option value="${esc(o.value)}" ${chosen.includes(o.value) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')
          : '<option disabled>Nothing found</option>'
      } catch (e) { select.innerHTML = `<option disabled>${esc(e.message)}</option>` }
    }
    let t
    search.oninput = () => { clearTimeout(t); t = setTimeout(() => load(search.value), 350) }
    select.onchange = () => {
      const sel = [...select.selectedOptions].filter((o) => o.value)
      state.fields[p.key] = p.multi ? sel.map((o) => o.value) : sel[0]?.value
      state.labels[p.key] = sel.map((o) => o.textContent)
    }
    box.append(f)
    load()
  }
}

// ---------- briefing ----------
function story(r) {
  const tag = catalog.tags.find((t) => t.label === r.topic)
  const [ico, hue] = tag ? TOPIC_LOOK[tag.id] || ['sparkles', 40] : catalog.companies.some((c) => c.label === r.topic) ? ['building', 40] : ['sparkles', 40]
  const sources = (r.sources || []).map((s) => `<span class="pill">${esc(SOURCES[s]?.[0] || s)}</span>`).join('')
  return `<article class="story"><span class="story-ico tinted" style="${tint(hue)}">${icon(ico)}</span><div>
    <div class="story-top"><span class="topic" style="--h: ${hue}">${esc(r.topic)}</span><span class="meter" title="How well it matches your interests"><i style="--v:${Math.max(0, Math.min(100, r.relevance))}%"></i>${r.relevance}</span></div>
    <h3>${esc(r.headline)}</h3><p>${esc(r.summary)}</p><p class="why"><b>Why it matters:</b> ${esc(r.why_it_matters)}</p>
    ${r.concept ? `<div class="concept">${icon('book')}<span>${esc(r.concept)}</span></div>` : ''}
    <div class="story-foot"><div class="pills">${sources}</div><a class="read" href="${esc(r.url)}" target="_blank" rel="noopener">Read the source ${icon('arrow')}</a></div>
  </div></article>`
}
let feed = null
const TAB_FILTER = { queued: (r) => r.status === 'queued', instant: (r) => r.mode === 'instant' && r.status === 'sent', digested: (r) => r.mode === 'digest' && r.status === 'sent' }
function renderFeedList() {
  const rows = feed.items.filter(TAB_FILTER[state.feedTab])
  const empty = { queued: 'Nothing waiting yet. New stories show up here after the next check.', instant: 'No major launches sent yet. When something big lands, it arrives right away.', digested: 'No digest delivered yet.' }[state.feedTab]
  $('#feed-list').innerHTML = rows.length ? rows.map(story).join('') : `<div class="empty">${icon('inbox')}<span>${empty}</span></div>`
  for (const b of $$('#feed-tabs button')) b.classList.toggle('on', b.dataset.tab === state.feedTab)
}
async function renderBriefing() {
  feed = await api('/api/feed')
  const count = (f) => feed.items.filter(f).length
  const live = feed.sources.filter((s) => s.ok).length
  const stats = [
    ['bolt', 45, count((r) => r.mode === 'instant' && r.status === 'sent'), 'Major alerts sent'],
    ['inbox', 225, count((r) => r.status === 'queued'), 'Waiting for your digest'],
    ['check', 150, count((r) => r.mode === 'digest' && r.status === 'sent'), 'Delivered in digests'],
    ['globe', 262, `${live}/${Math.max(3, feed.sources.length)}`, 'Sources live']
  ]
  $('#stats').innerHTML = stats.map(([i, hue, n, label]) => `<div class="stat"><span class="stat-ico tinted" style="${tint(hue)}">${icon(i)}</span><div><b>${n}</b><span>${label}</span></div></div>`).join('')
  if (feed.schedule) { $('#next-digest').textContent = feed.schedule.next; $('#schedule-text').textContent = feed.schedule.text }
  $('#sources').innerHTML = Object.entries(SOURCES).map(([id, [name, color, mark]]) => {
    const s = feed.sources.find((x) => x.name === id)
    const when = s ? `${s.ok ? 'Checked' : 'Unreachable'} ${new Date(s.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Not checked yet'
    return `<div class="source"><span class="source-logo" style="background:${color}">${mark}</span><div><b>${name}</b><span>${when}</span></div><i class="status-dot ${s && !s.ok ? 'off' : ''}" ${s ? '' : 'style="opacity:.3"'}></i></div>`
  }).join('')
  $('#deliveries').innerHTML = feed.deliveries.length
    ? feed.deliveries.slice(0, 8).map((d) => `<div class="tl ${d.ok ? '' : 'bad'}"><b>${esc(d.kind)}</b><span>${d.count} stor${d.count === 1 ? 'y' : 'ies'} · ${new Date(d.at).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}${d.ok ? '' : ' · will retry'}</span></div>`).join('')
    : `<div class="empty">${icon('send')}<span>Nothing delivered yet.</span></div>`
  // open on the first tab with something in it, the first time only
  if (!renderBriefing.opened) {
    renderBriefing.opened = true
    state.feedTab = ['queued', 'instant', 'digested'].find((t) => feed.items.some(TAB_FILTER[t])) || 'queued'
  }
  renderFeedList()
}

// ---------- saving ----------
const saved = {} // steps saved during setup, for the checkmarks in the menu
async function saveProfile() {
  const r = await api('/api/profile', {
    tags: [...state.tags], companies: [...state.companies], frequency: state.frequency, learningMode: state.learning,
    digestTime: state.digestTime, digestDay: state.digestDay, timezone: TZ
  })
  return r.message
}
async function save(section, btn) {
  await busy(btn, async () => {
    if (!state.tags.size) { show('interests'); throw new Error('Pick at least one topic.') }
    let msg = await saveProfile()
    if (section === 'delivery' || (me.onboarded && state.channel && state.channel !== me.delivery?.channel)) {
      if (!state.channel) throw new Error('Connect an app and choose where to deliver.')
      msg = (await api('/api/delivery', { channel: state.channel, fields: state.fields, labels: state.labels })).message
    }
    const wasOnboarded = me.onboarded
    me = await api('/api/me')
    saved[section] = true
    me.saved = saved
    renderNav()
    $('#test').hidden = !me.delivery?.ready
    toast(msg)
    // during setup each step leads to the next; afterwards Save keeps you where you are
    if (!wasOnboarded) show({ interests: 'schedule', schedule: 'delivery', delivery: 'briefing' }[section])
  })
}

// ---------- start ----------
async function init() {
  paintIcons()
  ;[catalog, me] = await Promise.all([api('/api/catalog'), api('/api/me')])
  // The token is fetched on page load, not in the click: the popup must open straight from the click.
  embed = await api(`/api/viasocket/token?apps=${catalog.apps.map((a) => a.slug).join(',')}`)
  loadConnectScript()
  me.profile.tags.forEach((t) => state.tags.add(t))
  me.profile.companies.forEach((c) => state.companies.add(c))
  Object.assign(state, {
    frequency: me.profile.frequency, digestTime: me.profile.digestTime || '09:00', digestDay: me.profile.digestDay ?? 1, learning: !!me.profile.learningMode,
    channel: me.delivery?.channel, fields: { ...(me.delivery?.fields || {}) }, labels: { ...(me.delivery?.labels || {}) }
  })
  renderInterests()
  renderSchedule()
  renderApps()
  if (state.channel) chooseApp(catalog.channels.find((c) => c.id === state.channel).app)
  $('#test').hidden = !me.delivery?.ready
  $('#test').onclick = (e) => busy(e.currentTarget, async () => toast((await api('/api/test-message', {})).message))
  for (const b of $$('[data-save]')) b.onclick = () => save(b.dataset.save, b)
  for (const b of $$('#nav button')) b.onclick = () => show(b.dataset.view)
  for (const b of $$('#feed-tabs button')) b.onclick = () => { state.feedTab = b.dataset.tab; renderFeedList() }
  renderNav()
  const wanted = location.hash.slice(1)
  show(HEAD[wanted] ? wanted : me.onboarded ? 'briefing' : 'interests')
  // back/forward and links like #schedule switch sections too
  window.addEventListener('hashchange', () => { const v = location.hash.slice(1); if (HEAD[v] && $(`.page[data-page=${v}]`).hidden) show(v) })
}
init().catch((e) => toast(e.message, true))
