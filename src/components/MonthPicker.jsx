import { useMemo } from 'react'
import { pad, todayISO } from '../lib/format'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/**
 * Month grid date picker.
 *  month: { y, m } (m = 0..11)
 *  marks: { 'YYYY-MM-DD': count } — dates that already have bookings
 *  minDate / maxDate: 'YYYY-MM-DD' bounds (inclusive)
 */
export default function MonthPicker({ month, onMonthChange, value, onChange, marks = {}, minDate, maxDate, color = '#1e3a8a' }) {
  const { y, m } = month
  const today = todayISO()

  const cells = useMemo(() => {
    const first = new Date(y, m, 1)
    const lead = (first.getDay() + 6) % 7 // Monday-first
    const days = new Date(y, m + 1, 0).getDate()
    const out = Array.from({ length: lead }, () => null)
    for (let d = 1; d <= days; d++) out.push(`${y}-${pad(m + 1)}-${pad(d)}`)
    while (out.length % 7) out.push(null)
    return out
  }, [y, m])

  const shift = (n) => {
    const d = new Date(y, m + n, 1)
    onMonthChange({ y: d.getFullYear(), m: d.getMonth() })
  }
  const monthStart = `${y}-${pad(m + 1)}-01`
  const canPrev = !minDate || monthStart > minDate.slice(0, 8) + '01'
  const nextStart = (() => { const d = new Date(y, m + 1, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01` })()
  const canNext = !maxDate || nextStart <= maxDate

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={() => shift(-1)} disabled={!canPrev} className="rounded-lg px-3 py-1.5 text-lg disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Previous month">‹</button>
        <div className="font-semibold">{new Date(y, m, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</div>
        <button type="button" onClick={() => shift(1)} disabled={!canNext} className="rounded-lg px-3 py-1.5 text-lg disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Next month">›</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-500">
        {WEEKDAYS.map((w) => <div key={w} className="py-1">{w}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((iso, i) => {
          if (!iso) return <div key={i} />
          const disabled = (minDate && iso < minDate) || (maxDate && iso > maxDate)
          const selected = iso === value
          const count = marks[iso] || 0
          return (
            <button
              key={iso}
              type="button"
              disabled={disabled}
              onClick={() => onChange(iso)}
              className={`relative flex aspect-square flex-col items-center justify-center rounded-xl text-sm transition
                ${selected ? 'font-bold text-white' : disabled ? 'text-slate-300 dark:text-slate-700' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}
                ${iso === today && !selected ? 'ring-1 ring-slate-400' : ''}`}
              style={selected ? { background: color } : undefined}
              aria-label={`${iso}${count ? `, ${count} booking${count > 1 ? 's' : ''}` : ''}`}
            >
              {Number(iso.slice(8))}
              {count > 0 && (
                <span className="absolute bottom-1 flex gap-0.5">
                  {Array.from({ length: Math.min(count, 3) }).map((_, k) => (
                    <span key={k} className="h-1 w-1 rounded-full" style={{ background: selected ? '#fff' : color }} />
                  ))}
                </span>
              )}
            </button>
          )
        })}
      </div>
      <div className="mt-2 flex items-center gap-1.5 px-1 text-xs text-slate-500">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} /> dots = existing bookings on that date
      </div>
    </div>
  )
}
