// Date/time helpers that never go through UTC, so IST dates don't shift.

export const pad = (n) => String(n).padStart(2, '0')

/** Local Date -> 'YYYY-MM-DD' */
export const toISODate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** 'YYYY-MM-DD' -> local Date at midnight */
export const fromISODate = (s) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const todayISO = () => toISODate(new Date())

export const addDays = (iso, n) => {
  const d = fromISODate(iso)
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

/** '14:30:00' or '14:30' -> minutes since midnight */
export const toMinutes = (t) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/** minutes -> 'HH:MM' */
export const fromMinutes = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`

/** '14:30:00' -> '2:30 PM' */
export const fmtTime = (t) => {
  if (!t) return ''
  const m = toMinutes(t)
  const h = Math.floor(m / 60)
  const mm = m % 60
  return `${((h + 11) % 12) + 1}:${pad(mm)} ${h < 12 ? 'AM' : 'PM'}`
}

export const fmtRange = (s, e) => `${fmtTime(s)} – ${fmtTime(e)}`

/** 'YYYY-MM-DD' -> 'Tue, 20 Oct 2026' */
export const fmtDate = (iso, opts = {}) =>
  fromISODate(iso).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', ...opts })

export const fmtDateLong = (iso) =>
  fromISODate(iso).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

/** Half-open overlap test, matching the database rule */
export const overlaps = (aStart, aEnd, bStart, bEnd) =>
  toMinutes(aStart) < toMinutes(bEnd) && toMinutes(aEnd) > toMinutes(bStart)

/** Statuses that hold a slot (must match the exclusion constraint) */
export const LIVE_STATUSES = ['pending', 'approved', 'cancel_requested']

export const STATUS = {
  pending:          { label: 'Pending',          cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200' },
  approved:         { label: 'Approved',         cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' },
  rejected:         { label: 'Rejected',         cls: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200' },
  withdrawn:        { label: 'Withdrawn',        cls: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  cancel_requested: { label: 'Cancel requested', cls: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200' },
  cancelled:        { label: 'Cancelled',        cls: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
}
