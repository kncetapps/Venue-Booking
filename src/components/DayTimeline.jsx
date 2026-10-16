import { fmtTime, toMinutes } from '../lib/format'

/**
 * Horizontal bar for one venue on one day: grey blocks = taken, coloured block = your choice
 * (red when it clashes). Hours run from dayStart to dayEnd.
 */
export default function DayTimeline({ dayStart, dayEnd, booked, start, end, color, clash }) {
  const s0 = toMinutes(dayStart)
  const total = toMinutes(dayEnd) - s0
  const pos = (t) => `${((toMinutes(t) - s0) / total) * 100}%`
  const width = (a, b) => `${((toMinutes(b) - toMinutes(a)) / total) * 100}%`

  const hours = []
  for (let m = Math.ceil(s0 / 60) * 60; m <= toMinutes(dayEnd); m += 60) hours.push(m)

  return (
    <div>
      <div className="relative h-10 overflow-hidden rounded-xl bg-emerald-50 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:ring-emerald-900">
        {booked.map((b) => (
          <div
            key={b.id}
            className="absolute inset-y-0 bg-slate-400/70 dark:bg-slate-600"
            style={{ left: pos(b.start_time), width: width(b.start_time, b.end_time),
              backgroundImage: 'repeating-linear-gradient(45deg, transparent 0 6px, rgba(255,255,255,.35) 6px 12px)' }}
            title={`${fmtTime(b.start_time)} – ${fmtTime(b.end_time)} · ${b.department}`}
          />
        ))}
        {start && end && toMinutes(end) > toMinutes(start) && (
          <div
            className="absolute inset-y-1 rounded-md opacity-90 ring-2 ring-white dark:ring-slate-900"
            style={{ left: pos(start), width: width(start, end), background: clash ? '#e11d48' : color }}
          />
        )}
      </div>
      <div className="relative mt-1 h-4 text-[10px] text-slate-500">
        {hours.map((m) => {
          const h = m / 60
          return (
            <span key={m} className="absolute -translate-x-1/2" style={{ left: `${((m - s0) / total) * 100}%` }}>
              {((h + 11) % 12) + 1}{h < 12 ? 'a' : 'p'}
            </span>
          )
        })}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-100 ring-1 ring-emerald-300" /> Free</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-slate-400" /> Booked</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} /> Your selection</span>
      </div>
    </div>
  )
}
