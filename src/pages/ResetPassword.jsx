import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AuthCard from '../components/AuthCard'
import { useAuth } from '../lib/auth'
import { friendlyError, supabase } from '../lib/supabase'

export default function ResetPassword() {
  const { session, clearRecovery } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    if (password.length < 8) return setError('Password must be at least 8 characters.')
    if (password !== confirm) return setError('Passwords do not match.')
    setBusy(true); setError('')
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) return setError(friendlyError(error))
    clearRecovery()
    navigate('/', { replace: true })
  }

  return (
    <AuthCard title="Set a new password">
      {session === null ? (
        <div className="alert-error">This reset link has expired or was already used. Request a new one from the log-in page.</div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error && <div className="alert-error">{error}</div>}
          <div>
            <label className="label" htmlFor="pw">New password</label>
            <input id="pw" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
          </div>
          <div>
            <label className="label" htmlFor="pw2">Confirm password</label>
            <input id="pw2" type="password" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" />
          </div>
          <button className="btn-primary w-full" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button>
        </form>
      )}
    </AuthCard>
  )
}
