import { useState } from 'react'
import Autocomplete from '../components/Autocomplete'
import { useAuth } from '../lib/auth'
import { friendlyError, supabase } from '../lib/supabase'
import { useMasters } from '../lib/useMasters'

export default function Profile() {
  const { profile, isAdmin, refreshProfile } = useAuth()
  const { departments } = useMasters()

  const [form, setForm] = useState({
    name: profile.name || '',
    phone: profile.phone || '',
    department: profile.department || '',
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null) // { ok, text }

  const [pw, setPw] = useState({ password: '', confirm: '' })
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg, setPwMsg] = useState(null)

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: typeof v === 'string' ? v : v.target.value }))
  const dirty = form.name !== (profile.name || '') || form.phone !== (profile.phone || '') || form.department !== (profile.department || '')

  const save = async (e) => {
    e.preventDefault()
    setMsg(null)
    if (!form.name.trim()) return setMsg({ ok: false, text: 'Name cannot be empty.' })
    if (!/^[0-9]{10}$/.test(form.phone)) return setMsg({ ok: false, text: 'Phone number must be 10 digits.' })
    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({ name: form.name.trim(), phone: form.phone, department: form.department.trim() })
      .eq('id', profile.id)
    setSaving(false)
    if (error) return setMsg({ ok: false, text: friendlyError(error) })
    await refreshProfile()
    setMsg({ ok: true, text: 'Profile updated.' })
  }

  const changePassword = async (e) => {
    e.preventDefault()
    setPwMsg(null)
    if (pw.password.length < 8) return setPwMsg({ ok: false, text: 'Password must be at least 8 characters.' })
    if (pw.password !== pw.confirm) return setPwMsg({ ok: false, text: 'Passwords do not match.' })
    setPwSaving(true)
    const { error } = await supabase.auth.updateUser({ password: pw.password })
    setPwSaving(false)
    if (error) return setPwMsg({ ok: false, text: friendlyError(error) })
    setPw({ password: '', confirm: '' })
    setPwMsg({ ok: true, text: 'Password changed.' })
  }

  const deptOptions = departments.map((d) => ({ value: d.short_name, label: d.full_name }))

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Profile</h1>
        <p className="text-slate-500">{isAdmin ? 'Administrator' : 'Department staff'} · joined {new Date(profile.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
      </div>

      <form onSubmit={save} className="card space-y-4">
        <h2 className="font-semibold">Details</h2>
        {msg && <div className={msg.ok ? 'alert-ok' : 'alert-error'}>{msg.text}</div>}

        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" className="input bg-slate-50 text-slate-500 dark:bg-slate-800" value={profile.email} disabled />
          <p className="mt-1 text-xs text-slate-500">Your login email can't be changed here. Ask the admin if it needs to change.</p>
        </div>
        <div>
          <label className="label" htmlFor="name">Name</label>
          <input id="name" className="input" value={form.name} onChange={set('name')} required autoComplete="name" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="phone">Phone</label>
            <input id="phone" inputMode="numeric" maxLength={10} className="input" value={form.phone}
              onChange={(e) => set('phone')(e.target.value.replace(/\D/g, ''))} required autoComplete="tel" />
          </div>
          <div>
            <label className="label" htmlFor="dept">Department</label>
            <Autocomplete id="dept" value={form.department} onChange={set('department')} options={deptOptions} placeholder="Type e.g. inf, mech…" required />
          </div>
        </div>
        <div className="flex justify-end">
          <button className="btn-primary" disabled={saving || !dirty}>{saving ? 'Saving…' : 'Save changes'}</button>
        </div>
      </form>

      <form onSubmit={changePassword} className="card space-y-4">
        <h2 className="font-semibold">Change password</h2>
        {pwMsg && <div className={pwMsg.ok ? 'alert-ok' : 'alert-error'}>{pwMsg.text}</div>}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="pw">New password</label>
            <input id="pw" type="password" className="input" value={pw.password}
              onChange={(e) => setPw((p) => ({ ...p, password: e.target.value }))} required minLength={8} autoComplete="new-password" />
          </div>
          <div>
            <label className="label" htmlFor="pw2">Confirm password</label>
            <input id="pw2" type="password" className="input" value={pw.confirm}
              onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))} required autoComplete="new-password" />
          </div>
        </div>
        <div className="flex justify-end">
          <button className="btn-ghost" disabled={pwSaving}>{pwSaving ? 'Saving…' : 'Change password'}</button>
        </div>
      </form>
    </div>
  )
}
