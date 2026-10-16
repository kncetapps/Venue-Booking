import { useState } from 'react'
import { Link } from 'react-router-dom'
import AuthCard from '../components/AuthCard'
import { friendlyError, supabase } from '../lib/supabase'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setBusy(false)
    if (error) setError(friendlyError(error))
    else setSent(true)
  }

  return (
    <AuthCard title="Reset password" subtitle="We'll mail you a link to set a new password."
      footer={<Link to="/login" className="font-semibold text-white underline">Back to log in</Link>}>
      {sent ? (
        <div className="alert-ok">If an account exists for <b>{email}</b>, a reset link is on its way. Check your inbox and spam folder.</div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error && <div className="alert-error">{error}</div>}
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <button className="btn-primary w-full" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button>
        </form>
      )}
    </AuthCard>
  )
}
