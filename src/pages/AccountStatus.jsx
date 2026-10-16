import AuthCard from '../components/AuthCard'
import { useAuth } from '../lib/auth'

const COPY = {
  pending: {
    title: 'Waiting for admin approval',
    body: 'Your email is verified. The admin will review your account shortly — you will get a mail once it is activated.',
    tone: 'alert-ok',
  },
  rejected: {
    title: 'Account not approved',
    body: 'The admin did not approve this account.',
    tone: 'alert-error',
  },
  inactive: {
    title: 'Account deactivated',
    body: 'This account has been deactivated by the admin. Your past bookings are kept.',
    tone: 'alert-error',
  },
  missing: {
    title: 'Profile not found',
    body: 'Your login exists but no staff profile was created. Please contact the admin.',
    tone: 'alert-error',
  },
}

export default function AccountStatus() {
  const { profile, user, signOut, refreshProfile } = useAuth()
  const c = COPY[profile?.status] || COPY.missing

  return (
    <AuthCard title={c.title} subtitle={user?.email}
      footer={<button onClick={signOut} className="font-semibold text-white underline">Log out</button>}>
      <div className={c.tone}>
        {c.body}
        {profile?.status_remark && <div className="mt-2"><b>Reason:</b> {profile.status_remark}</div>}
      </div>
      {profile?.status === 'pending' && (
        <button onClick={refreshProfile} className="btn-ghost mt-4 w-full">Check again</button>
      )}
    </AuthCard>
  )
}
