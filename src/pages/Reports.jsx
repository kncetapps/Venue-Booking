import { useEffect, useMemo, useState } from 'react'
import { StatusBadge, VenueDot } from '../components/BookingCard'
import { COLLEGE } from '../lib/college'
import { fmtDate, fmtRange, pad, toMinutes } from '../lib/format'
import { exportReportPdf, reportRow } from '../lib/pdf'
import { friendlyError, supabase } from '../lib/supabase'
import { useMasters } from '../lib/useMasters'

const thisMonth = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}` }
const monthLabel = (ym) => { const [y, m] = ym.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) }
const monthEnd = (ym) => { const [y, m] = ym.split('-').map(Number); return `${ym}-${pad(new Date(y, m, 0).getDate())}` }
const hours = (b) => (toMinutes(b.end_time) - toMinutes(b.start_time)) / 60
const fmtHours = (h) => (Number.isInteger(h) ? `${h}` : h.toFixed(1)) + ' h'

const STATUS_OPTIONS = [
  { value: 'approved', label: 'Approved (incl. cancel requested)' },
  { value: 'pending', label: 'Pending' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled / withdrawn' },
  { value: 'all', label: 'All statuses' },
]
const statusMatch = (f, s) =>
  f === 'all' ||
  (f === 'approved' && (s === 'approved' || s === 'cancel_requested')) ||
  (f === 'cancelled' && (s === 'cancelled' || s === 'withdrawn')) ||
  f === s

function CountList({ title, items, color }) {
  const max = Math.max(1, ...items.map((i) => i.count))
  return (
    <div className="card p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-600 dark:text-slate-300">{title}</h3>
      {items.length === 0 ? <div className="text-sm text-slate-500">—</div> : (
        <ul className="space-y-2">
          {items.map((i) => (
            <li key={i.key} className="text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5 truncate">{i.color && <VenueDot color={i.color} />}{i.key}</span>
                <span className="shrink-0 font-semibold tabular-nums">{i.count} <span className="font-normal text-slate-500">· {fmtHours(i.hours)}</span></span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800">
                <div className="h-1.5 rounded-full" style={{ width: `${(i.count / max) * 100}%`, background: i.color || color }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function Reports() {
  const { venues, departments, eventTypes } = useMasters()
  const [mode, setMode] = useState('month') // month | range | all
  const [month, setMonth] = useState(thisMonth)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [venueId, setVenueId] = useState('')
  const [dept, setDept] = useState('')
  const [etype, setEtype] = useState('')
  const [status, setStatus] = useState('approved')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState('')

  const range = mode === 'month' ? { from: `${month}-01`, to: monthEnd(month) }
    : mode === 'range' ? { from: from || null, to: to || null } : { from: null, to: null }

  useEffect(() => {
    let alive = true
    setLoading(true)
    let q = supabase.from('booking_calendar').select('*').order('booking_date').order('start_time')
    if (range.from) q = q.gte('booking_date', range.from)
    if (range.to) q = q.lte('booking_date', range.to)
    if (venueId) q = q.eq('venue_id', venueId)
    if (dept) q = q.eq('department', dept)
    q.then(({ data, error }) => {
      if (!alive) return
      setLoading(false)
      if (error) return setError(friendlyError(error))
      setError('')
      setRows(data || [])
    })
    return () => { alive = false }
  }, [range.from, range.to, venueId, dept])

  const filtered = useMemo(
    () => rows.filter((b) => statusMatch(status, b.status) && (!etype || b.event_type === etype)),
    [rows, status, etype],
  )

  const group = (keyFn, colorFn) => {
    const m = new Map()
    for (const b of filtered) {
      const k = keyFn(b)
      const g = m.get(k) || { key: k, count: 0, hours: 0, color: colorFn?.(b) }
      g.count++; g.hours += hours(b)
      m.set(k, g)
    }
    return [...m.values()].sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
  }
  const byHall = group((b) => b.venue_name, (b) => b.venue_color)
  const byDept = group((b) => b.department)
  const byType = group((b) => b.event_type)
  const totalHours = filtered.reduce((s, b) => s + hours(b), 0)

  const periodText = mode === 'month' ? monthLabel(month)
    : mode === 'range' ? `${range.from ? fmtDate(range.from) : 'Beginning'} – ${range.to ? fmtDate(range.to) : 'today onwards'}`
    : 'All dates'
  const filterText = [
    periodText,
    venueId && venues.find((v) => String(v.id) === String(venueId))?.name,
    dept && `Dept: ${dept}`,
    etype && `Type: ${etype}`,
    STATUS_OPTIONS.find((s) => s.value === status)?.label,
  ].filter(Boolean).join(' · ')

  const tableRows = filtered.map(reportRow)
  const HEAD = ['#', 'Date', 'Time', 'Hall', 'Dept', 'Event type', 'Title', 'In-charge', 'Entered by', 'Status', 'Ref no']
  const fileBase = `Venue-Bookings-${mode === 'month' ? month : new Date().toISOString().slice(0, 10)}`
  const totalsText = `Total bookings: ${filtered.length}   ·   Total hours: ${fmtHours(totalHours)}`
  const summaryItems = (items) => items.map((i) => [i.key, String(i.count), fmtHours(i.hours)])

  const exportPdf = async () => {
    setExporting('pdf')
    try {
      await exportReportPdf({
        filterText,
        totals: totalsText,
        rows: tableRows.map((r) => r.map(String)),
        summaries: [
          { title: 'Hall', items: summaryItems(byHall) },
          { title: 'Department', items: summaryItems(byDept) },
          { title: 'Event type', items: summaryItems(byType) },
        ],
        fileName: `${fileBase}.pdf`,
      })
    } catch (e) {
      setError(`PDF export failed: ${e.message}`)
    }
    setExporting('')
  }

  const exportExcel = async () => {
    setExporting('xlsx')
    try {
      const { default: writeExcelFile } = await import('write-excel-file/browser')
      const N = HEAD.length
      const title = (v, size = 11) => ({ value: v, fontWeight: 'bold', fontSize: size, align: 'center', columnSpan: N })
      const centre = (v) => ({ value: v, align: 'center', columnSpan: N })
      const padRow = (cell) => [cell, ...Array(N - 1).fill(null)]
      const letterhead = [
        padRow(title(COLLEGE.name, 14)),
        padRow(title(COLLEGE.status)),
        ...COLLEGE.lines.map((l) => padRow(centre(l))),
        padRow(title(COLLEGE.address, 10)),
        [],
      ]
      const main = [
        ...letterhead,
        padRow(title('VENUE BOOKING REPORT', 12)),
        padRow(centre(filterText)),
        padRow(centre(totalsText)),
        [],
        HEAD.map((h) => ({ value: h, fontWeight: 'bold', backgroundColor: '#1E3A8A', textColor: '#FFFFFF' })),
        ...tableRows.map((r) => r.map((v) => (v === '' ? null : v))),
      ]
      const sum = (t, items) => [
        [{ value: t, fontWeight: 'bold' }, { value: 'Bookings', fontWeight: 'bold' }, { value: 'Hours', fontWeight: 'bold' }],
        ...items.map((i) => [i.key, i.count, Math.round(i.hours * 100) / 100]),
        [],
      ]
      const summary = [...sum('Hall', byHall), ...sum('Department', byDept), ...sum('Event type', byType)]
      await writeExcelFile([
        { data: main, sheet: 'Bookings', columns: [{ width: 5 }, { width: 18 }, { width: 20 }, { width: 18 }, { width: 8 }, { width: 16 }, { width: 40 }, { width: 22 }, { width: 22 }, { width: 16 }, { width: 14 }] },
        { data: summary, sheet: 'Summary', columns: [{ width: 30 }, { width: 10 }, { width: 10 }] },
      ]).toFile(`${fileBase}.xlsx`)
    } catch (e) {
      setError(`Excel export failed: ${e.message}`)
    }
    setExporting('')
  }

  const reset = () => { setMode('month'); setMonth(thisMonth()); setVenueId(''); setDept(''); setEtype(''); setStatus('approved') }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-slate-500">Filter by month, hall, department or event type, then export.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={exportExcel} disabled={!filtered.length || !!exporting}>
            {exporting === 'xlsx' ? 'Preparing…' : 'Excel'}
          </button>
          <button className="btn-primary" onClick={exportPdf} disabled={!filtered.length || !!exporting}>
            {exporting === 'pdf' ? 'Preparing…' : 'PDF'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="sm:col-span-2 lg:col-span-1">
          <label className="label">Period</label>
          <div className="mb-2 flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            {[['month', 'Month'], ['range', 'Date range'], ['all', 'All']].map(([k, l]) => (
              <button key={k} type="button" onClick={() => setMode(k)}
                className={`flex-1 rounded-lg py-1.5 text-sm font-semibold ${mode === k ? 'bg-white shadow-sm dark:bg-slate-900' : 'text-slate-500'}`}>{l}</button>
            ))}
          </div>
          {mode === 'month' && <input type="month" className="input" value={month} onChange={(e) => setMonth(e.target.value || thisMonth())} aria-label="Month" />}
          {mode === 'range' && (
            <div className="grid grid-cols-2 gap-2">
              <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
              <input type="date" className="input" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
            </div>
          )}
        </div>
        <div>
          <label className="label" htmlFor="f-hall">Hall</label>
          <select id="f-hall" className="input" value={venueId} onChange={(e) => setVenueId(e.target.value)}>
            <option value="">All halls</option>
            {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="f-dept">Department</label>
          <select id="f-dept" className="input" value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="">All departments</option>
            {departments.map((d) => <option key={d.id} value={d.short_name}>{d.short_name} — {d.full_name}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="f-type">Event type</label>
          <select id="f-type" className="input" value={etype} onChange={(e) => setEtype(e.target.value)}>
            <option value="">All event types</option>
            {eventTypes.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="f-status">Status</label>
          <select id="f-status" className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div className="flex items-end">
          <button className="btn-ghost w-full" onClick={reset}>Reset filters</button>
        </div>
      </div>

      {error && <div className="alert-error">{error}</div>}

      {/* Totals */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="card p-4"><div className="text-sm text-slate-500">Bookings</div><div className="mt-1 text-3xl font-bold">{loading ? '–' : filtered.length}</div></div>
        <div className="card p-4"><div className="text-sm text-slate-500">Hours booked</div><div className="mt-1 text-3xl font-bold">{loading ? '–' : fmtHours(totalHours)}</div></div>
        <div className="card p-4"><div className="text-sm text-slate-500">Halls used</div><div className="mt-1 text-3xl font-bold">{loading ? '–' : byHall.length}</div></div>
        <div className="card p-4"><div className="text-sm text-slate-500">Departments</div><div className="mt-1 text-3xl font-bold">{loading ? '–' : byDept.length}</div></div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <CountList title="By hall" items={byHall} />
        <CountList title="By department" items={byDept} color="#1e3a8a" />
        <CountList title="By event type" items={byType} color="#64748b" />
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        <div className="border-b border-slate-200 px-4 py-3 text-sm text-slate-500 dark:border-slate-800">{filterText}</div>
        {loading ? <div className="p-4 text-slate-500">Loading…</div> : filtered.length === 0 ? (
          <div className="p-4 text-slate-500">No bookings match these filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase dark:bg-slate-800/50">
                <tr>
                  {['Date', 'Time', 'Hall', 'Dept', 'Event', 'In-charge', 'Entered by', 'Status', 'Ref'].map((h) => <th key={h} className="px-4 py-2.5">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((b) => (
                  <tr key={b.id} className="align-top">
                    <td className="px-4 py-2.5 whitespace-nowrap">{fmtDate(b.booking_date)}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{fmtRange(b.start_time, b.end_time)}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap"><span className="flex items-center gap-1.5"><VenueDot color={b.venue_color} />{b.venue_name}</span></td>
                    <td className="px-4 py-2.5">{b.department}</td>
                    <td className="px-4 py-2.5"><div className="font-medium">{b.title}</div><div className="text-xs text-slate-500">{b.event_type}</div></td>
                    <td className="px-4 py-2.5">{b.faculty_name}</td>
                    <td className="px-4 py-2.5">{b.booked_by_name || '—'}</td>
                    <td className="px-4 py-2.5"><StatusBadge status={b.status} /></td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-slate-500">{b.ref_no || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
