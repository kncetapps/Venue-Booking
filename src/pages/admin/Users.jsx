import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../lib/auth'
import { friendlyError, supabase } from '../../lib/supabase'

const TABS = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Active' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'inactive', label: 'Inactive' },
]

const fmt = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

export default function Users() {
  const { profile: me } = useAuth()
  const [tab, setTab] = useState('pending')
  const [rows, setRows] = useState([])
  const [counts, setCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [prompt, setPrompt] = useState(null) // { user, status, title }
  const [reason, setReason] = useState('')
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    setLoading(false)
    if (error) return setError(friendlyError(error))
    const c = {}
    for (const r of data) c[r.status] = (c[r.status] || 0) + 1
    setCounts(c)
    setRows(data)
  }, [])

  useEffect(() => { load() }, [load])

  const update = async (user, patch) => {
    setError('')
    const { error } = await supabase.from('profiles').update(patch).eq('id', user.id)
    if (error) return setError(friendlyError(error))
    load()
  }

  const confirmPrompt = async (e) => {
    e.preventDefault()
    await update(prompt.user, { status: prompt.status, status_remark: reason.trim() })
    setPrompt(null); setReason('')
  }

  const q = search.trim().toLowerCase()
  const shown = rows.filter((r) => r.status === tab &&
    (!q || [r.name, r.email, r.department, r.phone].some((v) => (v || '').toLowerCase().includes(q))))

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Users</h1>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-xl bg-slate-200/70 p-1 dark:bg-slate-800">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${tab === t.key ? 'bg-white shadow-sm dark:bg-slate-900' : 'text-slate-600 dark:text-slate-400'}`}>
              {t.label}{counts[t.key] ? <span className="ml-1.5 text-xs text-slate-500">{counts[t.key]}</span> : null}
            </button>
          ))}
        </div>
        <input className="input max-w-xs" placeholder="Search name, email, dept…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {error && <div className="alert-error">{error}</div>}

      {loading ? (
        <div className="text-slate-500">Loading…</div>
      ) : shown.length === 0 ? (
        <div className="card text-slate-500">No {TABS.find((t) => t.key === tab).label.toLowerCase()} users.</div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {shown.map((u) => (
            <div key={u.id} className="card flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-semibold">
                    {u.name}
                    {u.role === 'admin' && <span className="ml-2 rounded-md bg-brand-100 px-1.5 py-0.5 text-xs font-semibold text-brand-700">Admin</span>}
                  </div>
                  <div className="truncate text-sm text-slate-500">{u.email}</div>
                </div>
                <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold dark:bg-slate-800">{u.department || '—'}</span>
              </div>
              <div className="text-sm text-slate-500">
                {u.phone || 'No phone'} · Signed up {fmt(u.created_at)}
                {u.status_remark && <div className="mt-1 text-slate-600 dark:text-slate-400">Reason: {u.status_remark}</div>}
              </div>

              {u.id !== me.id && (
                <div className="flex flex-wrap gap-2">
                  {u.status === 'pending' && <>
                    <button className="btn-success py-2" onClick={() => update(u, { status: 'approved', status_remark: null })}>Approve</button>
                    <button className="btn-ghost py-2" onClick={() => setPrompt({ user: u, status: 'rejected', title: 'Reject sign-up' })}>Reject</button>
                  </>}
                  {u.status === 'approved' && <>
                    <button className="btn-ghost py-2" onClick={() => setPrompt({ user: u, status: 'inactive', title: 'Deactivate user' })}>Deactivate</button>
                    <button className="btn-ghost py-2" onClick={() => update(u, { role: u.role === 'admin' ? 'user' : 'admin' })}>
                      {u.role === 'admin' ? 'Remove admin' : 'Make admin'}
                    </button>
                  </>}
                  {(u.status === 'rejected' || u.status === 'inactive') && (
                    <button className="btn-success py-2" onClick={() => update(u, { status: 'approved', status_remark: null })}>
                      {u.status === 'rejected' ? 'Approve' : 'Reactivate'}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {prompt && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={() => setPrompt(null)}>
          <form onSubmit={confirmPrompt} onClick={(e) => e.stopPropagation()} className="card w-full max-w-md space-y-4">
            <h2 className="text-lg font-bold">{prompt.title}</h2>
            <p className="text-sm text-slate-500">{prompt.user.name} · {prompt.user.email}</p>
            <div>
              <label className="label" htmlFor="reason">Reason (shown to the user)</label>
              <textarea id="reason" className="input min-h-24" value={reason} onChange={(e) => setReason(e.target.value)} required autoFocus />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setPrompt(null)}>Cancel</button>
              <button className="btn-danger">Confirm</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
