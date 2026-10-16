import { useEffect, useState } from 'react'
import { supabase } from './supabase'

const DEFAULTS = { day_start: '08:00:00', day_end: '18:00:00', buffer_minutes: 0, max_days_ahead: 180 }

export function useSettings() {
  const [settings, setSettings] = useState(DEFAULTS)
  useEffect(() => {
    supabase.from('settings').select('*').maybeSingle().then(({ data }) => { if (data) setSettings(data) })
  }, [])
  return settings
}
