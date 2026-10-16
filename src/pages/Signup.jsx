import { useState } from 'react'
import { Link } from 'react-router-dom'
import AuthCard from '../components/AuthCard'
import Autocomplete from '../components/Autocomplete'
import { friendlyError, supabase } from '../lib/supabase'
import { useMasters } from '../lib/useMasters'

export default function Signup() {
  const { departments } = useMasters()
  const [form, setForm] = useState({ department: '', name: '', email: '', phone: '', password: '', confirm: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: typeof v === 'string' ? v : v.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!/^[0-9]{10}$/.test(form.phone)) return setError('Phone number must be 10 digits.')
    if (form.password.length < 8) return setError('Password must be at least 8 characters.')
    if (form.password !== form.confirm) return setError('Passwords do not match.')

    setBusy(true)
    const { data, error } = await supabase.auth.signUp({
      email: form.email.trim().toLowerCase(),
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/login?verified=1`,
        data: { name: form.name.trim(), phone: form.phone, department: form.department.trim() },
      },
    })
    setBusy(false)
    if (error) return setError(friendlyError(error))
    // Supabase returns a user with no identities when the email is already registered
    if (data.user && data.user.identities?.length === 0) {
      return setError('An account with this email already exists. Try logging in or reset your password.')
    }
    setDone(true)
  }

  if (done) {
    return (
      <AuthCard title="Check your email" footer={<Link to="/login" className="font-semibold text-white underline">Back to log in</Link>}>
        <ol className="space-y-3 text-[15px] text-slate-700 dark:text-slate-300">
          <li><b>1.</b> We sent a verification link to <b>{form.email}</b>. Open it to confirm your email.</li>
          <li><b>2.</b> Your account then goes to the admin for approval.</li>
          <li><b>3.</b> Once approved, you'll get a mail and can log in to book venues.</li>
        </ol>
        <p className="mt-4 text-sm text-slate-500">Didn't get it? Check the spam folder.</p>
      </AuthCard>
    )
  }

  const deptOptions = departments.map((d) => ({ value: d.short_name, label: d.full_name }))

  return (
    <AuthCard
      title="Create an account"
      subtitle="For department staff. The admin approves every new account."
      footer={<>Already registered? <Link to="/login" className="font-semibold text-white underline">Log in</Link></>}
    >
      <form onSubmit={submit} className="space-y-4">
        {error && <div className="alert-error">{error}</div>}
        <div>
          <label className="label" htmlFor="dept">Department</label>
          <Autocomplete id="dept" value={form.department} onChange={set('department')} options={deptOptions} placeholder="Type e.g. inf, mech…" required />
        </div>
        <div>
          <label className="label" htmlFor="name">Name</label>
          <input id="name" className="input" value={form.name} onChange={set('name')} required autoComplete="name" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" className="input" value={form.email} onChange={set('email')} required autoComplete="email" />
          </div>
          <div>
            <label className="label" htmlFor="phone">Phone</label>
            <input id="phone" inputMode="numeric" maxLength={10} className="input" value={form.phone}
              onChange={(e) => set('phone')(e.target.value.replace(/\D/g, ''))} required autoComplete="tel" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="pw">Password</label>
            <input id="pw" type="password" className="input" value={form.password} onChange={set('password')} required minLength={8} autoComplete="new-password" />
          </div>
          <div>
            <label className="label" htmlFor="pw2">Confirm password</label>
            <input id="pw2" type="password" className="input" value={form.confirm} onChange={set('confirm')} required autoComplete="new-password" />
          </div>
        </div>
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Creating account…' : 'Sign up'}</button>
      </form>
    </AuthCard>
  )
}
