import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import BookingCard from '../../components/BookingCard'
import { STATUS, fmtDate, todayISO } from '../../lib/format'
import { friendlyError, supabase } from '../../lib/supabase'

const TABS = [
  { key: 'pending', label: 'New requests' },
  { key: 'cancel', label: 'Cancel requests' },
  { key: 'all', label: 'All bookings' },
]

// What each decision does: new status, whether a remark is required, button style
const ACTIONS = {
  approve:       { status: 'approved',  title: 'Approve booking',          remark: 'optional', btn: 'btn-success', label: 'Approve' },
  reject:        { status: 'rejected',  title: 'Reject booking',           remark: 'required', btn: 'btn-danger',  label: 'Reject' },
  approveCancel: { status: 'cancelled', title: 'Approve cancellation',     remark: 'optional', btn: 'btn-danger',  label: 'Approve cancellation' },
  rejectCancel:  { status: 'approved',  title: 'Keep booking (reject cancellation)', remark: 'required', btn: 'btn-primary', label: 'Keep booking' },
  adminCancel:   { status: 'cancelled', title: 'Cancel this booking',      remark: 'required', btn: 'btn-danger',  label: 'Cancel booking' },
}

const ACTION_LABEL = {
  created: 'Requested', edited: 'Edited', rescheduled: 'Rescheduled',
}

function History({ id, people }) {
  const [rows, setRows] = useState(null)
  useEffect(() => {
    supabase.from('booking_logs').select('*').eq('booking_id', id).order('at').then(({ data }) => setRows(data || []))
  }, [id])
  if (!rows) return <div className="text-sm text-slate-500">Loading history…</div>
  return (
    <ol className="space-y-1.5 border-l-2 border-slate-200 pl-3 text-sm dark:border-slate-700">
      {rows.map((r) => (
        <li key={r.id}>
          <span className="font-medium">
            {r.action === 'status_changed' ? (STATUS[r.to_status]?.label || r.to_status) : (ACTION_LABEL[r.action] || r.action)}
          </span>
          <span className="text-slate-500"> · {people[r.by_user]?.name || 'System'} · {new Date(r.at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
          {r.remark && <div className="text-slate-600 dark:text-slate-400">“{r.remark}”</div>}
        </li>
      ))}
    </ol>
  )
}

export default function Requests() {
  const [tab, setTab] = useState('pending')
  const [rows, setRows] = useState([])
  const [people, setPeople] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [dialog, setDialog] = useState(null) // { action, b }
  const [remark, setRemark] = useState('')
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState({}) // history open per booking
  const [search, setSearch] = useState('')
  const [showPast, setShowPast] = useState(false)

  const load = useCallback(async () => {
    const [{ data, error }, { data: ppl }] = await Promise.all([
      supabase.from('booking_calendar').select('*').order('booking_date').order('start_time'),
      supabase.from('profiles').select('id, name, email, phone, department'),
    ])
    setLoading(false)
    if (error) return setError(friendlyError(error))
    setRows(data || [])
    setPeople(Object.fromEntries((ppl || []).map((p) => [p.id, p])))
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const ch = supabase.channel('admin-requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  const today = todayISO()
  const pending = rows.filter((b) => b.status === 'pending')
  const cancels = rows.filter((b) => b.status === 'cancel_requested')

  const shown = useMemo(() => {
    if (tab === 'pending') return pending
    if (tab === 'cancel') return cancels
    const q = search.trim().toLowerCase()
    return rows
      .filter((b) => showPast || b.booking_date >= today)
      .filter((b) => !q || [b.title, b.department, b.venue_name, b.faculty_name, b.ref_no, b.event_type, people[b.user_id]?.name]
        .some((v) => (v || '').toLowerCase().includes(q)))
      .sort((a, b) => (showPast ? -1 : 1) * (a.booking_date.localeCompare(b.booking_date) || a.start_time.localeCompare(b.start_time)))
  }, [tab, rows, pending, cancels, search, showPast, today, people])

  const decide = async (e) => {
    e?.preventDefault()
    const a = ACTIONS[dialog.action]
    setBusy(true); setError('')
    const patch = { status: a.status, admin_remark: remark.trim() || null }
    const { error } = await supabase.from('bookings').update(patch).eq('id', dialog.b.id)
    setBusy(false)
    if (error) { setError(friendlyError(error)); setDialog(null); return }
    setNotice(`${dialog.b.title}: ${STATUS[a.status].label.toLowerCase()}.`)
    setDialog(null); setRemark('')
    load()
  }

  const ask = (action, b) => { setRemark(''); setDialog({ action, b }) }

  const actionsFor = (b) => {
    const buttons = []
    if (b.status === 'pending') {
      buttons.push(<button key="a" className="btn-success py-2" onClick={() => ask('approve', b)}>Approve</button>)
      buttons.push(<button key="r" className="btn-ghost py-2 text-rose-700 dark:text-rose-300" onClick={() => ask('reject', b)}>Reject</button>)
    }
    if (b.status === 'cancel_requested') {
      buttons.push(<button key="ac" className="btn-danger py-2" onClick={() => ask('approveCancel', b)}>Approve cancellation</button>)
      buttons.push(<button key="rc" className="btn-ghost py-2" onClick={() => ask('rejectCancel', b)}>Keep booking</button>)
    }
    if (b.status === 'approved' && b.booking_date >= today) {
      buttons.push(<Link key="e" to={`/book/${b.id}`} className="btn-ghost py-2">Edit / reschedule</Link>)
      buttons.push(<button key="c" className="btn-ghost py-2 text-rose-700 dark:text-rose-300" onClick={() => ask('adminCancel', b)}>Cancel</button>)
    }
    if (b.status === 'pending') buttons.push(<Link key="e" to={`/book/${b.id}`} className="btn-ghost py-2">Edit</Link>)
    buttons.push(
      <button key="h" className="btn-ghost py-2 text-sm" onClick={() => setOpen((o) => ({ ...o, [b.id]: !o[b.id] }))}>
        {open[b.id] ? 'Hide history' : 'History'}
      </button>,
    )
    return buttons
  }

  const counts = { pending: pending.length, cancel: cancels.length }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Booking requests</h1>
        <p className="text-slate-500">Approve or reject new bookings and cancellation requests. Every decision is recorded in the booking's history.</p>
      </div>

      <div className="-mx-1 flex gap-1 overflow-x-auto px-1">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-semibold ${tab === t.key ? 'bg-brand-700 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800'}`}>
            {t.label}
            {counts[t.key] > 0 && (
              <span className={`rounded-full px-1.5 text-xs ${tab === t.key ? 'bg-white/25' : 'bg-amber-100 text-amber-800'}`}>{counts[t.key]}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'all' && (
        <div className="flex flex-wrap items-center gap-3">
          <input className="input max-w-sm" placeholder="Search title, department, hall, faculty, ref…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} className="h-4 w-4" />
            Include past bookings
          </label>
        </div>
      )}

      {notice && (
        <div className="alert-ok flex items-start justify-between gap-3">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} aria-label="Dismiss">×</button>
        </div>
      )}
      {error && <div className="alert-error">{error}</div>}

      {loading ? (
        <div className="text-slate-500">Loading…</div>
      ) : shown.length === 0 ? (
        <div className="card text-slate-500">
          {tab === 'pending' ? 'No new booking requests. 🎉' : tab === 'cancel' ? 'No cancellation requests.' : 'No bookings match.'}
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {shown.map((b) => {
            const who = people[b.user_id]
            return (
              <div key={b.id} className="space-y-2">
                <BookingCard b={b} showDate actions={actionsFor(b)} />
                <div className="px-1 text-xs text-slate-500">
                  Requested by <b>{who?.name || 'Unknown'}</b>{who?.department ? ` (${who.department})` : ''}{who?.email ? ` · ${who.email}` : ''}
                  {' · '}{new Date(b.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' })}
                  {b.booking_date < today && b.status === 'pending' && <span className="ml-1 font-semibold text-rose-600">· date has passed</span>}
                </div>
                {open[b.id] && <div className="card p-4"><History id={b.id} people={people} /></div>}
              </div>
            )
          })}
        </div>
      )}

      {dialog && (() => {
        const a = ACTIONS[dialog.action]
        const b = dialog.b
        return (
          <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={() => setDialog(null)}>
            <form onSubmit={decide} onClick={(e) => e.stopPropagation()} className="card w-full max-w-md space-y-4">
              <h2 className="text-lg font-bold">{a.title}</h2>
              <div className="rounded-xl bg-slate-100 p-3 text-sm dark:bg-slate-800">
                <div className="font-semibold">{b.title}</div>
                <div className="text-slate-600 dark:text-slate-300">{b.venue_name} · {fmtDate(b.booking_date)} · {b.start_time.slice(0, 5)}–{b.end_time.slice(0, 5)} · {b.department}</div>
                {b.cancel_reason && dialog.action.includes('Cancel') && dialog.action !== 'adminCancel' && (
                  <div className="mt-1">Reason given: “{b.cancel_reason}”</div>
                )}
              </div>
              <div>
                <label className="label" htmlFor="remark">
                  {a.remark === 'required' ? 'Reason (sent to the requester)' : 'Note for the requester (optional)'}
                </label>
                <textarea id="remark" className="input min-h-24" value={remark} onChange={(e) => setRemark(e.target.value)} required={a.remark === 'required'} autoFocus />
              </div>
              {dialog.action === 'approve' && <p className="text-xs text-slate-500">A reference number (VB-YYYY-NNNN) is issued on approval.</p>}
              <div className="flex justify-end gap-2">
                <button type="button" className="btn-ghost" onClick={() => setDialog(null)}>Back</button>
                <button className={a.btn} disabled={busy}>{busy ? 'Saving…' : a.label}</button>
              </div>
            </form>
          </div>
        )
      })()}
    </div>
  )
}
