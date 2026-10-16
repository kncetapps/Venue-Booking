import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

const Stat = ({ label, value, tone }) => (
  <div className="card p-4">
    <div className="text-sm text-slate-500">{label}</div>
    <div className={`mt-1 text-3xl font-bold ${tone}`}>{value ?? '–'}</div>
  </div>
)

export default function Dashboard() {
  const { profile, isAdmin } = useAuth()
  const [mine, setMine] = useState(null)
  const [pendingUsers, setPendingUsers] = useState(null)

  useEffect(() => {
    supabase.from('bookings').select('status').eq('user_id', profile.id).then(({ data }) => {
      const c = { total: 0, pending: 0, approved: 0, rejected: 0 }
      for (const b of data || []) {
        c.total++
        if (b.status in c) c[b.status]++
      }
      setMine(c)
    })
    if (isAdmin) {
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'pending')
        .then(({ count }) => setPendingUsers(count ?? 0))
    }
  }, [profile.id, isAdmin])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome, {profile.name.split(' ')[0]}</h1>
        <p className="text-slate-500">{profile.department} · {isAdmin ? 'Administrator' : 'Department staff'}</p>
      </div>

      {isAdmin && pendingUsers > 0 && (
        <Link to="/admin/users" className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          <span><b>{pendingUsers}</b> new sign-up{pendingUsers > 1 ? 's' : ''} waiting for approval</span>
          <span className="font-semibold">Review →</span>
        </Link>
      )}

      <section>
        <h2 className="mb-3 font-semibold text-slate-600 dark:text-slate-300">My bookings</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Total" value={mine?.total} />
          <Stat label="Pending" value={mine?.pending} tone="text-amber-600" />
          <Stat label="Approved" value={mine?.approved} tone="text-emerald-600" />
          <Stat label="Rejected" value={mine?.rejected} tone="text-rose-600" />
        </div>
      </section>

      <div className="card text-slate-600 dark:text-slate-300">
        The booking form and the venue calendar arrive in the next build phase.
      </div>
    </div>
  )
}
