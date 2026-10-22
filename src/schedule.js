// When a user's digest goes out: their chosen time (and day, for weekly) in their own time zone.
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const DEFAULT_TIME = '09:00'
export const DEFAULT_DAY = 1

export function validTimeZone(tz) {
  if (typeof tz !== 'string' || !tz) return false
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true } catch { return false }
}

/** "HH:MM" on a half-hour, or null. */
export function validTime(t) {
  return typeof t === 'string' && /^([01]\d|2[0-3]):(00|30)$/.test(t) ? t : null
}

export function formatTime(t = DEFAULT_TIME) {
  const [h, m] = t.split(':').map(Number)
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

/** Wall-clock parts of an instant in a time zone. */
function zoned(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
  }).formatToParts(date)
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]))
  return { y: +p.year, m: +p.month, d: +p.day, minutes: +p.hour * 60 + +p.minute, weekday: WEEKDAYS.indexOf(p.weekday) }
}

function settings(profile) {
  return {
    period: profile.frequency === 'weekly' ? 'weekly' : 'daily', // "instant for major only" still gets a daily digest of the rest
    tz: validTimeZone(profile.timezone) ? profile.timezone : 'UTC',
    time: validTime(profile.digestTime) || DEFAULT_TIME,
    day: Number.isInteger(profile.digestDay) ? profile.digestDay : DEFAULT_DAY
  }
}

/**
 * The digest slot that has most recently passed, or null if it was already sent (or predates the user).
 * Returns { period, key }: key names the slot, so one slot is delivered at most once.
 */
export function digestDue(user, now = new Date()) {
  const { period, tz, time, day } = settings(user.profile)
  const [hh, mm] = time.split(':').map(Number)
  const p = zoned(now, tz)
  let back = period === 'weekly' ? (p.weekday - day + 7) % 7 : 0
  if (back === 0 && p.minutes < hh * 60 + mm) back = period === 'weekly' ? 7 : 1
  const slot = new Date(Date.UTC(p.y, p.m - 1, p.d - back)) // the slot's local date
  const key = `${period}:${slot.toISOString().slice(0, 10)}`
  if (user.lastDigestKey === key) return null
  // the slot as an instant: local wall time minus the zone's current offset
  const offset = Date.UTC(p.y, p.m - 1, p.d, Math.floor(p.minutes / 60), p.minutes % 60) - Math.floor(now.getTime() / 60000) * 60000
  const slotAt = Date.UTC(slot.getUTCFullYear(), slot.getUTCMonth(), slot.getUTCDate(), hh, mm) - offset
  if (slotAt < Date.parse(user.createdAt)) return null
  return { period, key }
}

/** Plain words for the next digest: "Today at 9:00 AM", "Tomorrow at 6:30 PM", "Monday at 9:00 AM". */
export function nextDigestLabel(profile, now = new Date()) {
  const { period, tz, time, day } = settings(profile)
  const [hh, mm] = time.split(':').map(Number)
  const p = zoned(now, tz)
  let ahead = period === 'weekly' ? (day - p.weekday + 7) % 7 : 0
  if (ahead === 0 && p.minutes >= hh * 60 + mm) ahead = period === 'weekly' ? 7 : 1
  const when = ahead === 0 ? 'Today' : ahead === 1 ? 'Tomorrow' : WEEKDAYS[(p.weekday + ahead) % 7]
  return `${when} at ${formatTime(time)}`
}

/** One sentence describing the user's schedule. */
export function scheduleText(profile) {
  const { time, day } = settings(profile)
  const at = formatTime(time)
  if (profile.frequency === 'instant') return `Major launches arrive the moment they happen; everything else comes in a short digest every day at ${at}.`
  if (profile.frequency === 'weekly') return `One roundup every ${WEEKDAYS[day]} at ${at}. Truly major launches still arrive right away.`
  return `One digest every day at ${at}. Truly major launches still arrive right away.`
}
