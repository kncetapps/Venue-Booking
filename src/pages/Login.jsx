import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import AuthCard from '../components/AuthCard'
import { friendlyError, supabase } from '../lib/supabase'

export default function Login() {
  const [params] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState(params.get('verified') ? 'Email verified. Your account is now waiting for admin approval — you can log in to check its status.' : '')
  const [unconfirmed, setUnconfirmed] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setError(''); setInfo(''); setUnconfirmed(false)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) {
      setError(friendlyError(error))
      setUnconfirmed(error.message.includes('Email not confirmed'))
    }
  }

  const resend = async () => {
    const { error } = await supabase.auth.resend({
      type: 'signup', email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/login?verified=1` },
    })
    if (error) setError(friendlyError(error))
    else { setError(''); setUnconfirmed(false); setInfo('Verification link sent again. Check your inbox (and spam folder).') }
  }

  return (
    <AuthCard
      title="Log in"
      subtitle="Book seminar halls and auditoriums for your department."
      footer={<>New staff member? <Link to="/signup" className="font-semibold text-white underline">Create an account</Link></>}
    >
      <form onSubmit={submit} className="space-y-4">
        {info && <div className="alert-ok">{info}</div>}
        {error && (
          <div className="alert-error">
            {error}
            {unconfirmed && <button type="button" onClick={resend} className="ml-1 font-semibold underline">Resend link</button>}
          </div>
        )}
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <label className="label" htmlFor="password">Password</label>
            <Link to="/forgot-password" className="text-sm font-medium text-brand-600">Forgot password?</Link>
          </div>
          <input id="password" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        </div>
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
      </form>
    </AuthCard>
  )
}
