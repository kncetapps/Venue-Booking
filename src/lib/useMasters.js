import { useEffect, useState } from 'react'
import { supabase } from './supabase'

/** Active departments / event types / venues, ordered as the admin set them. */
export function useMasters() {
  const [data, setData] = useState({ departments: [], eventTypes: [], venues: [], loading: true })

  useEffect(() => {
    let alive = true
    Promise.all([
      supabase.from('departments').select('*').eq('active', true).order('sort_order'),
      supabase.from('event_types').select('*').eq('active', true).order('sort_order'),
      supabase.from('venues').select('*').eq('active', true).order('sort_order'),
    ]).then(([d, e, v]) => {
      if (alive) setData({ departments: d.data || [], eventTypes: e.data || [], venues: v.data || [], loading: false })
    })
    return () => { alive = false }
  }, [])

  return data
}
