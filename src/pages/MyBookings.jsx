import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import BookingCard from '../components/BookingCard'
import ConfirmationButton from '../components/ConfirmationButton'
import { useAuth } from '../lib/auth'
import { todayISO } from '../lib/format'
import { friendlyError, supabase } from '../lib/supabase'

const TABS = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'pending', label: 'Pending' },
  { key: 'past', label: 'Past' },
  { key: 'closed', label: 'Rejected / Cancelled' },
]
const CLOSED = ['rejected', 'withdrawn', 'cancelled']

export default function MyBookings() {
  const { profile } = useAuth()
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = useState('upcoming')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dialog, setDialog] = useState(null) // { type: 'withdraw' | 'cancel', b }
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const flashId = params.get('new') || params.get('updated')
  const flash = params.get('new')
    ? 'Booking submitted. The slot is held for you while the admin reviews it.'
    : params.get('updated') ? 'Booking updated.' : ''

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('booking_calendar').select('*')
      .eq('user_id', profile.id).order('booking_date', { ascending: true }).order('start_time')
    setLoading(false)
    if (error) return setError(friendlyError(error))
    setRows(data || [])
  }, [profile.id])

  useEffect(() => { load() }, [load])

  const today = todayISO()
  const filtered = rows.filter((b) => {
    if (tab === 'upcoming') return b.booking_date >= today && !CLOSED.includes(b.status)
    if (tab === 'pending') return b.status === 'pending' || b.status === 'cancel_requested'
    if (tab === 'past') return b.booking_date < today && !CLOSED.includes(b.status)
    return CLOSED.includes(b.status)
  })
  if (tab === 'past' || tab === 'closed') filtered.reverse()
  const count = (k) => rows.filter((b) => {
    if (k === 'upcoming') return b.booking_date >= today && !CLOSED.includes(b.status)
    if (k === 'pending') return b.status === 'pending' || b.status === 'cancel_requested'
    return false
  }).length

  const act = async (e) => {
    e?.preventDefault()
    setBusy(true); setError('')
    const patch = dialog.type === 'withdraw'
      ? { status: 'withdrawn' }
      : { status: 'cancel_requested', cancel_reason: reason.trim() }
    const { error } = await supabase.from('bookings').update(patch).eq('id', dialog.b.id)
    setBusy(false)
    if (error) { setError(friendlyError(error)); setDialog(null); return }
    setDialog(null); setReason('')
    load()
  }

  const actionsFor = (b) => {
    const future = b.booking_date >= today
    if (b.status === 'pending' && future) {
      return <>
        <Link to={`/book/${b.id}`} className="btn-ghost py-2">Edit</Link>
        <button className="btn-ghost py-2 text-rose-700 dark:text-rose-300" onClick={() => setDialog({ type: 'withdraw', b })}>Withdraw</button>
      </>
    }
    if (b.status === 'approved' && future) {
      return <>
        <ConfirmationButton b={b} />
        <button className="btn-ghost py-2" onClick={() => { setReason(''); setDialog({ type: 'cancel', b }) }}>Request cancellation</button>
      </>
    }
    if (b.status === 'approved') return <ConfirmationButton b={b} />
    if (b.status === 'cancel_requested') {
      return <p className="text-sm text-orange-700 dark:text-orange-300">Waiting for the admin to approve the cancellation. The slot stays booked until then.</p>
    }
    return null
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">My Bookings</h1>
          <p className="text-slate-500">Edit or withdraw while pending; approved bookings need a cancellation request.</p>
        </div>
        <Link to="/book" className="btn-primary">+ New booking</Link>
      </div>

      {flash && (
        <div className="alert-ok flex items-start justify-between gap-3">
          <span>{flash}</span>
          <button onClick={() => setParams({})} className="font-semibold" aria-label="Dismiss">×</button>
        </div>
      )}
      {error && <div className="alert-error">{error}</div>}

      <div className="-mx-1 flex gap-1 overflow-x-auto px-1">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold ${tab === t.key ? 'bg-brand-700 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800'}`}>
            {t.label}{count(t.key) ? <span className="ml-1.5 opacity-75">{count(t.key)}</span> : null}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-slate-500">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="card text-slate-500">
          {tab === 'upcoming' ? <>No upcoming bookings. <Link to="/book" className="font-semibold text-brand-600">Book a venue →</Link></> : 'Nothing here.'}
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {filtered.map((b) => (
            <BookingCard key={b.id} b={b} showDate highlight={String(b.id) === flashId} actions={actionsFor(b)} />
          ))}
        </div>
      )}

      {dialog && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={() => setDialog(null)}>
          <form onSubmit={act} onClick={(e) => e.stopPropagation()} className="card w-full max-w-md space-y-4">
            {dialog.type === 'withdraw' ? (
              <>
                <h2 className="text-lg font-bold">Withdraw this request?</h2>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  <b>{dialog.b.title}</b> at {dialog.b.venue_name}. The slot will be released for others. This can't be undone.
                </p>
              </>
            ) : (
              <>
                <h2 className="text-lg font-bold">Request cancellation</h2>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  <b>{dialog.b.title}</b> at {dialog.b.venue_name}. The booking stays on the calendar until the admin approves the cancellation.
                </p>
                <div>
                  <label className="label" htmlFor="reason">Reason</label>
                  <textarea id="reason" className="input min-h-24" value={reason} onChange={(e) => setReason(e.target.value)} required autoFocus />
                </div>
              </>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setDialog(null)}>Keep booking</button>
              <button className="btn-danger" disabled={busy}>
                {busy ? 'Saving…' : dialog.type === 'withdraw' ? 'Withdraw' : 'Send request'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
