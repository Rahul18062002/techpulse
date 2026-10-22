import { connect, loadConnectScript } from '/vendor/viasocket-apps/browser.js'

const $ = (s) => document.querySelector(s)
const api = async (path, body) => {
  const res = await fetch(path, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  // detail is the server's own reason, sent only outside production: it makes a screenshot enough to diagnose
  if (!res.ok) throw new Error((data.error || 'Something went wrong') + (data.detail ? ` (${data.detail})` : ''))
  return data
}
const SOURCE_NAMES = { hackernews: 'Hacker News', arxiv: 'arXiv', github: 'GitHub' }
// An icon that can't load (blocked image host) becomes the app's first letter.
const icon = (app, size) => `<img src="${esc(app.icon)}" alt="" width="${size}" height="${size}" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'badge',textContent:'${esc(app.name[0])}'}))">`
const esc = (s = '') => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
function toast(msg, error = false) {
  const t = $('#toast'); t.textContent = msg; t.className = error ? 'error' : ''; t.hidden = false
  clearTimeout(toast.timer); toast.timer = setTimeout(() => (t.hidden = true), 9000)
  t.scrollIntoView({ block: 'nearest' })
}
async function busy(btn, fn) { btn.disabled = true; try { await fn() } catch (e) { toast(e.message, true) } finally { btn.disabled = false } }

let catalog, me, embed
const state = { tags: new Set(), companies: new Set(), channel: null, fields: {}, labels: {} }

function chips(el, list, set) {
  el.innerHTML = ''
  for (const { id, label } of list) {
    const b = document.createElement('button')
    b.className = 'chip'; b.textContent = label; b.setAttribute('aria-pressed', set.has(id))
    b.onclick = () => { set.has(id) ? set.delete(id) : set.add(id); b.setAttribute('aria-pressed', set.has(id)) }
    el.append(b)
  }
}

function renderFrequency() {
  $('#freq').innerHTML = catalog.frequencies.map((f) => `<label class="option"><input type="radio" name="freq" value="${f.id}" ${me.profile.frequency === f.id ? 'checked' : ''}><span><b>${esc(f.label)}</b><br><span class="muted">${esc(f.text)}</span></span></label>`).join('')
}

function renderApps() {
  $('#apps').innerHTML = ''
  for (const app of catalog.apps) {
    const c = me.connections[app.slug]
    const div = document.createElement('div'); div.className = 'app'
    div.innerHTML = `<div class="name">${icon(app, 24)}${esc(app.name)}</div>`
    if (c && !c.expired) div.insertAdjacentHTML('beforeend', `<div class="status">✓ Connected${c.label ? ` · ${esc(c.label)}` : ''}</div>`)
    const btn = document.createElement('button'); btn.className = 'connect'
    btn.innerHTML = `${icon(app, 16)} ${c ? (c.expired ? 'Reconnect' : 'Use ' + esc(app.name)) : 'Connect ' + esc(app.name)}`
    btn.onclick = () => (c && !c.expired ? chooseApp(app.slug) : connectApp(app.slug, c?.expired ? c.authId : undefined, btn))
    div.append(btn); $('#apps').append(div)
  }
}

async function connectApp(slug, authId, btn) {
  const save = async (id) => {
    const r = await api('/api/viasocket/connected', { app: slug, authId: id })
    toast(r.message); me = await api('/api/me'); renderApps(); chooseApp(slug)
  }
  btn.disabled = true
  try {
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
  const list = catalog.channels.filter((c) => c.app === slug)
  $('#channel-box').hidden = false
  $('#channels').innerHTML = list.map((c) => `<label class="option"><input type="radio" name="channel" value="${c.id}" ${state.channel === c.id ? 'checked' : ''}><span><b>${esc(c.label)}</b><br><span class="muted">${esc(c.hint)}</span></span></label>`).join('')
  for (const r of document.querySelectorAll('input[name=channel]')) r.onchange = () => selectChannel(r.value)
  if (!list.some((c) => c.id === state.channel)) selectChannel(list[0].id, true)
  else renderFields()
}

function selectChannel(id, check) {
  if (state.channel !== id) { state.fields = {}; state.labels = {} }
  state.channel = id
  if (check) document.querySelector(`input[name=channel][value="${id}"]`).checked = true
  renderFields()
}

function renderFields() {
  const ch = catalog.channels.find((c) => c.id === state.channel)
  const box = $('#fields'); box.innerHTML = ''
  for (const a of ch.ask) {
    const f = document.createElement('div'); f.className = 'field'
    f.innerHTML = `<label>${esc(a.label)}</label><input type="email" placeholder="you@example.com" value="${esc(state.fields[a.key] || '')}">`
    f.querySelector('input').oninput = (e) => (state.fields[a.key] = e.target.value)
    box.append(f)
  }
  for (const p of ch.pick) {
    const f = document.createElement('div'); f.className = 'field'
    f.innerHTML = `<label>${esc(p.label)}</label><input type="search" placeholder="Search…"><select ${p.multi ? 'multiple' : ''}><option disabled>Loading…</option></select>`
    const [search, select] = f.querySelectorAll('input, select')
    const load = async (q = '') => {
      try {
        const { options } = await api(`/api/options?channel=${ch.id}&key=${encodeURIComponent(p.key)}&q=${encodeURIComponent(q)}`)
        const chosen = [].concat(state.fields[p.key] || [])
        select.innerHTML = (p.multi ? '' : '<option value="">Choose…</option>') + options.map((o) => `<option value="${esc(o.value)}" ${chosen.includes(o.value) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')
        if (!options.length) select.innerHTML = '<option disabled>Nothing found</option>'
      } catch (e) { select.innerHTML = `<option disabled>${esc(e.message)}</option>` }
    }
    let t; search.oninput = () => { clearTimeout(t); t = setTimeout(() => load(search.value), 350) }
    select.onchange = () => {
      const sel = [...select.selectedOptions].filter((o) => o.value)
      state.fields[p.key] = p.multi ? sel.map((o) => o.value) : sel[0]?.value
      state.labels[p.key] = sel.map((o) => o.textContent)
    }
    box.append(f); load()
  }
}

async function saveAll(btn) {
  await busy(btn, async () => {
    const frequency = document.querySelector('input[name=freq]:checked')?.value
    const p = await api('/api/profile', { tags: [...state.tags], companies: [...state.companies], frequency, learningMode: $('#learning').checked })
    let msg = p.message
    if (state.channel) msg += ' ' + (await api('/api/delivery', { channel: state.channel, fields: state.fields, labels: state.labels })).message
    else if (!me.delivery?.ready) throw new Error('Connect an app and choose where to deliver.')
    me = await api('/api/me'); toast(msg); $('#test').hidden = !me.delivery?.ready; navShow()
  })
}

function item(r) {
  return `<div class="item"><div class="h">${esc(r.headline)}<span class="pill">${esc(r.topic)}</span></div><p>${esc(r.summary)}</p><p class="muted"><i>Why it matters:</i> ${esc(r.why_it_matters)}</p>${r.concept ? `<p class="muted">💡 ${esc(r.concept)}</p>` : ''}<div class="meta"><a href="${esc(r.url)}" target="_blank" rel="noopener">Source</a> · ${esc((r.sources || []).map((x) => SOURCE_NAMES[x] || x).join(', '))}</div></div>`
}

async function renderFeed() {
  const f = await api('/api/feed')
  const fill = (el, rows) => ($(el).innerHTML = rows.length ? rows.map(item).join('') : '<div class="empty">Nothing here yet.</div>')
  fill('#instant', f.items.filter((r) => r.mode === 'instant' && r.status === 'sent'))
  fill('#queued', f.items.filter((r) => r.status === 'queued'))
  fill('#digested', f.items.filter((r) => r.mode === 'digest' && r.status === 'sent'))
  $('#deliveries').innerHTML = f.deliveries.length ? f.deliveries.map((d) => `<div class="item">${d.ok ? '✓' : '⚠'} ${esc(d.kind)} · ${d.count} item${d.count === 1 ? '' : 's'} · ${new Date(d.at).toLocaleString()}${d.detail ? ` · ${esc(d.detail)}` : ''}</div>`).join('') : '<div class="empty">No deliveries yet.</div>'
  const freq = catalog.frequencies.find((x) => x.id === me.profile.frequency)
  const ch = catalog.channels.find((c) => c.id === me.delivery?.channel)
  $('#schedule').textContent = `${freq?.text || ''} Delivering to: ${ch?.label || 'not set'}.`
}

function show(view) {
  $('#setup').hidden = view !== 'setup'; $('#feed').hidden = view !== 'feed'
  if (view === 'feed') renderFeed().catch((e) => toast(e.message, true))
}
function navShow() { document.querySelector('[data-view=feed]').hidden = !me.onboarded }

async function init() {
  [catalog, me] = await Promise.all([api('/api/catalog'), api('/api/me')])
  // The token is fetched on page load, not in the click: the popup must open straight from the click.
  embed = await api(`/api/viasocket/token?apps=${catalog.apps.map((a) => a.slug).join(',')}`)
  loadConnectScript()
  me.profile.tags.forEach((t) => state.tags.add(t)); me.profile.companies.forEach((c) => state.companies.add(c))
  state.channel = me.delivery?.channel; state.fields = { ...(me.delivery?.fields || {}) }; state.labels = { ...(me.delivery?.labels || {}) }
  chips($('#tags'), catalog.tags, state.tags); chips($('#companies'), catalog.companies, state.companies)
  $('#learning').checked = me.profile.learningMode
  renderFrequency(); renderApps()
  if (state.channel) chooseApp(catalog.channels.find((c) => c.id === state.channel).app)
  $('#test').hidden = !me.delivery?.ready
  if (me.onboarded) $('#setup-title').textContent = 'Your settings'
  navShow()
  $('#save').onclick = (e) => saveAll(e.currentTarget)
  $('#test').onclick = (e) => busy(e.currentTarget, async () => toast((await api('/api/test-message', {})).message))
  $('#check').onclick = (e) => busy(e.currentTarget, async () => { toast('Checking sources… this can take a minute.'); toast((await api('/api/check-now', {})).message); await renderFeed() })
  $('#digest').onclick = (e) => busy(e.currentTarget, async () => { toast((await api('/api/digest-now', {})).message); await renderFeed() })
  for (const b of document.querySelectorAll('[data-view]')) b.onclick = () => show(b.dataset.view)
  show(me.onboarded ? 'feed' : 'setup')
}
init().catch((e) => toast(e.message, true))
