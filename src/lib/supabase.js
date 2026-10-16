import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseConfigured = Boolean(url && key)

export const supabase = createClient(url || 'http://localhost', key || 'missing-key', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

/** Turn Postgres / auth errors into sentences a staff member can act on. */
export function friendlyError(error) {
  const msg = error?.message || String(error || 'Something went wrong')
  if (msg.includes('no_overlapping_bookings')) return 'That venue is already booked for an overlapping time. Pick another slot.'
  if (msg.includes('Invalid login credentials')) return 'Wrong email or password.'
  if (msg.includes('Email not confirmed')) return 'Please verify your email first — open the link we sent you.'
  if (msg.includes('User already registered')) return 'An account with this email already exists. Try logging in or reset your password.'
  if (msg.includes('row-level security')) return 'You do not have permission to do that.'
  return msg
}
