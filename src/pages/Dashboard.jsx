import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import BookingCalendar from '../components/BookingCalendar'
import { StatusBadge, VenueDot } from '../components/BookingCard'
import { useAuth } from '../lib/auth'
import { LIVE_STATUSES, addDays, fmtDate, fmtRange, todayISO } from '../lib/format'
import { supabase } from '../lib/supabase'

const Stat = ({ label, value, tone = '', to }) => (
  <Link to={to} className="card block p-4 transition hover:shadow-md">
    <div className="text-sm text-slate-500">{label}</div>
    <div className={`mt-1 text-3xl font-bold ${tone}`}>{value ?? '–'}</div>
  </Link>
)

export default function Dashboard() {
  const { profile, isAdmin } = useAuth()
  const [mine, setMine] = useState(null)
  const [week, setWeek] = useState([])
  const [pendingUsers, setPendingUsers] = useState(null)
  const [pendingBookings, setPendingBookings] = useState(null)

  useEffect(() => {
    const today = todayISO()
    supabase.from('bookings').select('status').eq('user_id', profile.id).then(({ data }) => {
      const c = { total: 0, pending: 0, approved: 0, rejected: 0 }
      for (const b of data || []) {
        c.total++
        if (b.status === 'cancel_requested') c.approved++
        else if (b.status in c) c[b.status]++
      }
      setMine(c)
    })
    supabase.from('booking_calendar').select('*')
      .gte('booking_date', today).lte('booking_date', addDays(today, 6)).in('status', LIVE_STATUSES)
      .order('booking_date').order('start_time').limit(20)
      .then(({ data }) => setWeek(data || []))
    if (isAdmin) {
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'pending')
        .then(({ count }) => setPendingUsers(count ?? 0))
      supabase.from('bookings').select('id', { count: 'exact', head: true }).in('status', ['pending', 'cancel_requested'])
        .then(({ count }) => setPendingBookings(count ?? 0))
    }
  }, [profile.id, isAdmin])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Welcome, {profile.name.split(' ')[0]}</h1>
          <p className="text-slate-500">{profile.department} · {isAdmin ? 'Administrator' : 'Department staff'}</p>
        </div>
        <Link to="/book" className="btn-primary">+ New booking</Link>
      </div>

      {isAdmin && (pendingUsers > 0 || pendingBookings > 0) && (
        <div className="space-y-2">
          {pendingUsers > 0 && (
            <Link to="/admin/users" className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3.5 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
              <span><b>{pendingUsers}</b> new sign-up{pendingUsers > 1 ? 's' : ''} waiting for approval</span>
              <span className="font-semibold">Review →</span>
            </Link>
          )}
          {pendingBookings > 0 && (
            <Link to="/admin/requests" className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3.5 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
              <span><b>{pendingBookings}</b> booking / cancellation request{pendingBookings > 1 ? 's' : ''} waiting for a decision</span>
              <span className="font-semibold">Review →</span>
            </Link>
          )}
        </div>
      )}

      <section>
        <h2 className="mb-3 font-semibold text-slate-600 dark:text-slate-300">My bookings</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Total" value={mine?.total} to="/my-bookings" />
          <Stat label="Pending" value={mine?.pending} tone="text-amber-600" to="/my-bookings" />
          <Stat label="Approved" value={mine?.approved} tone="text-emerald-600" to="/my-bookings" />
          <Stat label="Rejected" value={mine?.rejected} tone="text-rose-600" to="/my-bookings" />
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-semibold text-slate-600 dark:text-slate-300">Upcoming this week · all venues</h2>
        {week.length === 0 ? (
          <div className="card text-slate-500">No events in the next 7 days.</div>
        ) : (
          <div className="card divide-y divide-slate-100 p-0 dark:divide-slate-800">
            {week.map((b) => (
              <div key={b.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-14 shrink-0 text-center">
                  <div className="text-xs font-semibold text-slate-500 uppercase">{fmtDate(b.booking_date, { weekday: 'short', day: undefined, month: undefined, year: undefined })}</div>
                  <div className="text-lg font-bold">{Number(b.booking_date.slice(8))}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{b.title}</div>
                  <div className="flex items-center gap-1.5 truncate text-sm text-slate-500">
                    <VenueDot color={b.venue_color} />{b.venue_name} · {fmtRange(b.start_time, b.end_time)} · {b.department}
                  </div>
                </div>
                <StatusBadge status={b.status} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-semibold text-slate-600 dark:text-slate-300">Calendar</h2>
        <BookingCalendar compact />
      </section>
    </div>
  )
}
