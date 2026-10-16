import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { useAuth } from './lib/auth'
import { supabaseConfigured } from './lib/supabase'
import AccountStatus from './pages/AccountStatus'
import BookingForm from './pages/BookingForm'
import Calendar from './pages/Calendar'
import ComingSoon from './pages/ComingSoon'
import Dashboard from './pages/Dashboard'
import ForgotPassword from './pages/ForgotPassword'
import Login from './pages/Login'
import MyBookings from './pages/MyBookings'
import Profile from './pages/Profile'
import ResetPassword from './pages/ResetPassword'
import Signup from './pages/Signup'
import Masters from './pages/admin/Masters'
import Users from './pages/admin/Users'

function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-100 border-t-brand-700" />
    </div>
  )
}

export default function App() {
  const { session, loading, isApproved, isAdmin, recovery } = useAuth()

  if (!supabaseConfigured) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <div className="alert-error max-w-md">
          Supabase is not configured. Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>.
        </div>
      </div>
    )
  }
  if (loading) return <Splash />

  // Signed out
  if (!session) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  // Signed in via a password-reset link
  if (recovery) return <ResetPassword />

  // Signed in but not yet approved / rejected / deactivated
  if (!isApproved) return <AccountStatus />

  return (
    <Routes>
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="book" element={<BookingForm key="new" />} />
        <Route path="book/:id" element={<BookingForm key="edit" />} />
        <Route path="my-bookings" element={<MyBookings />} />
        <Route path="reports" element={<ComingSoon title="Reports" />} />
        <Route path="profile" element={<Profile />} />
        {isAdmin && <Route path="admin/users" element={<Users />} />}
        {isAdmin && <Route path="admin/masters" element={<Masters />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
