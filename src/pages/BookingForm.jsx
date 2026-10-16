import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Autocomplete from '../components/Autocomplete'
import { VenueDot } from '../components/BookingCard'
import DayTimeline from '../components/DayTimeline'
import MonthPicker from '../components/MonthPicker'
import { useAuth } from '../lib/auth'
import {
  LIVE_STATUSES, addDays, fmtDateLong, fmtRange, fmtTime, fromMinutes, overlaps, pad, toMinutes, todayISO,
} from '../lib/format'
import { friendlyError, supabase } from '../lib/supabase'
import { useMasters } from '../lib/useMasters'
import { useSettings } from '../lib/useSettings'

const STEP = 15 // minutes between time options

function Section({ n, title, hint, children, disabled }) {
  return (
    <section className={`card space-y-4 ${disabled ? 'pointer-events-none opacity-50' : ''}`}>
      <div className="flex items-baseline gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-700 text-sm font-bold text-white">{n}</span>
        <div>
          <h2 className="font-semibold">{title}</h2>
          {hint && <p className="text-sm text-slate-500">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

export default function BookingForm() {
  const { id: editId } = useParams()
  const navigate = useNavigate()
  const { profile, isAdmin } = useAuth()
  const { departments, eventTypes, venues, loading: mastersLoading } = useMasters()
  const settings = useSettings()

  const [form, setForm] = useState({
    department: profile.department || '',
    event_type: '',
    title: '',
    details: '',
    venue_id: null,
    booking_date: '',
    start_time: '',
    end_time: '',
    participants: '',
    faculty_name: profile.name || '',
    faculty_phone: profile.phone || '',
    faculty_email: profile.email || '',
    requirements: '',
  })
  const [loadingEdit, setLoadingEdit] = useState(!!editId)
  const [editError, setEditError] = useState('')
  const [month, setMonth] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() } })
  const [marks, setMarks] = useState({})
  const [dayBookings, setDayBookings] = useState([])
  const [dayLoading, setDayLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const dateRef = useRef(null)
  const timeRef = useRef(null)

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v && v.target ? v.target.value : v }))
  const venue = venues.find((v) => v.id === form.venue_id)
  const color = venue?.color || '#1e3a8a'
  const minDate = isAdmin ? undefined : todayISO()
  const maxDate = isAdmin ? undefined : addDays(todayISO(), settings.max_days_ahead)

  // ---- Edit mode: load the booking ----
  useEffect(() => {
    if (!editId) return
    supabase.from('bookings').select('*').eq('id', editId).maybeSingle().then(({ data, error }) => {
      setLoadingEdit(false)
      if (error || !data) return setEditError('Booking not found.')
      if (!isAdmin && (data.user_id !== profile.id || data.status !== 'pending')) {
        return setEditError('Only your own Pending bookings can be edited. For an approved booking, send a cancellation request from My Bookings.')
      }
      setForm({
        department: data.department, event_type: data.event_type, title: data.title, details: data.details || '',
        venue_id: data.venue_id, booking_date: data.booking_date,
        start_time: data.start_time.slice(0, 5), end_time: data.end_time.slice(0, 5),
        participants: data.participants ?? '', faculty_name: data.faculty_name, faculty_phone: data.faculty_phone,
        faculty_email: data.faculty_email, requirements: data.requirements || '',
      })
      const [y, m] = data.booking_date.split('-').map(Number)
      setMonth({ y, m: m - 1 })
    })
  }, [editId, isAdmin, profile.id])

  // ---- Dates in this month that already have bookings for the venue ----
  useEffect(() => {
    if (!form.venue_id) return setMarks({})
    const { y, m } = month
    const from = `${y}-${pad(m + 1)}-01`
    const to = `${y}-${pad(m + 1)}-${pad(new Date(y, m + 1, 0).getDate())}`
    let alive = true
    supabase.from('booking_calendar').select('id, booking_date')
      .eq('venue_id', form.venue_id).gte('booking_date', from).lte('booking_date', to).in('status', LIVE_STATUSES)
      .then(({ data }) => {
        if (!alive) return
        const c = {}
        for (const b of data || []) if (String(b.id) !== String(editId)) c[b.booking_date] = (c[b.booking_date] || 0) + 1
        setMarks(c)
      })
    return () => { alive = false }
  }, [form.venue_id, month, editId])

  // ---- Bookings on the chosen venue + date ----
  const loadDay = useRef()
  loadDay.current = async () => {
    if (!form.venue_id || !form.booking_date) return setDayBookings([])
    setDayLoading(true)
    const { data } = await supabase.from('booking_calendar').select('*')
      .eq('venue_id', form.venue_id).eq('booking_date', form.booking_date).in('status', LIVE_STATUSES).order('start_time')
    setDayLoading(false)
    setDayBookings((data || []).filter((b) => String(b.id) !== String(editId)))
  }
  useEffect(() => { loadDay.current() }, [form.venue_id, form.booking_date])

  // ---- Time options within working hours ----
  const dayStart = settings.day_start.slice(0, 5)
  const dayEnd = settings.day_end.slice(0, 5)
  const startOptions = useMemo(() => {
    const out = []
    for (let m = toMinutes(dayStart); m < toMinutes(dayEnd); m += STEP) out.push(fromMinutes(m))
    return out
  }, [dayStart, dayEnd])
  const endOptions = useMemo(() => {
    if (!form.start_time) return []
    const out = []
    for (let m = toMinutes(form.start_time) + STEP; m <= toMinutes(dayEnd); m += STEP) out.push(fromMinutes(m))
    return out
  }, [form.start_time, dayEnd])

  // Is a start time already inside a booked slot? (used to grey out options)
  const buffer = settings.buffer_minutes || 0
  const startTaken = (t) => dayBookings.some((b) =>
    toMinutes(t) >= toMinutes(b.start_time) - buffer && toMinutes(t) < toMinutes(b.end_time) + buffer)

  const clashes = useMemo(() => {
    if (!form.start_time || !form.end_time) return []
    const s = fromMinutes(Math.max(0, toMinutes(form.start_time) - buffer))
    const e = fromMinutes(Math.min(24 * 60 - 1, toMinutes(form.end_time) + buffer))
    return dayBookings.filter((b) => overlaps(s, e, b.start_time, b.end_time))
  }, [form.start_time, form.end_time, dayBookings, buffer])

  const pickVenue = (id) => {
    setForm((f) => ({ ...f, venue_id: id }))
    setTimeout(() => dateRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }
  const pickDate = (iso) => {
    setForm((f) => ({ ...f, booking_date: iso }))
    setTimeout(() => timeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }
  const pickStart = (t) => setForm((f) => {
    let end = f.end_time
    if (!end || toMinutes(end) <= toMinutes(t)) {
      end = fromMinutes(Math.min(toMinutes(t) + 60, toMinutes(dayEnd)))
    }
    return { ...f, start_time: t, end_time: end }
  })

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.venue_id) return setError('Choose a venue.')
    if (!form.booking_date) return setError('Choose a date.')
    if (!form.start_time || !form.end_time) return setError('Choose start and end time.')
    if (clashes.length) return setError('The selected time overlaps an existing booking. Pick a free slot.')
    if (!/^[0-9]{10}$/.test(form.faculty_phone)) return setError('Phone number must be 10 digits.')
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.faculty_email)) return setError('Enter a valid email.')

    const row = {
      department: form.department.trim(),
      event_type: form.event_type.trim(),
      title: form.title.trim(),
      details: form.details.trim() || null,
      venue_id: form.venue_id,
      booking_date: form.booking_date,
      start_time: form.start_time,
      end_time: form.end_time,
      participants: form.participants ? Number(form.participants) : null,
      faculty_name: form.faculty_name.trim(),
      faculty_phone: form.faculty_phone,
      faculty_email: form.faculty_email.trim().toLowerCase(),
      requirements: form.requirements.trim() || null,
    }

    setBusy(true)
    const q = editId
      ? supabase.from('bookings').update(row).eq('id', editId).select('id').single()
      : supabase.from('bookings').insert({ ...row, user_id: profile.id }).select('id').single()
    const { data, error } = await q
    setBusy(false)
    if (error) {
      setError(friendlyError(error))
      loadDay.current() // someone may have just taken the slot
      return
    }
    navigate(`/my-bookings?${editId ? 'updated' : 'new'}=${data.id}`)
  }

  if (loadingEdit || mastersLoading) return <div className="text-slate-500">Loading…</div>
  if (editError) {
    return (
      <div className="max-w-2xl space-y-4">
        <h1 className="text-2xl font-bold">Edit booking</h1>
        <div className="alert-error">{editError}</div>
        <Link to="/my-bookings" className="btn-ghost">Back to My Bookings</Link>
      </div>
    )
  }

  const deptOptions = departments.map((d) => ({ value: d.short_name, label: d.full_name }))
  const typeOptions = eventTypes.map((t) => ({ value: t.name }))

  return (
    <form onSubmit={submit} className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{editId ? 'Edit booking' : 'New booking'}</h1>
        <p className="text-slate-500">Choose the venue first — you'll see what's already taken before picking a date and time.</p>
      </div>

      <Section n={1} title="Event">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="dept">Department</label>
            <Autocomplete id="dept" value={form.department} onChange={set('department')} options={deptOptions} placeholder="Type e.g. inf, mech…" required />
          </div>
          <div>
            <label className="label" htmlFor="etype">Event type</label>
            <Autocomplete id="etype" value={form.event_type} onChange={set('event_type')} options={typeOptions} placeholder="Seminar, Workshop…" required />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="title">Event title</label>
          <input id="title" className="input" value={form.title} onChange={set('title')} required maxLength={200} placeholder="e.g. National Seminar on Cloud Computing" />
        </div>
        <div>
          <label className="label" htmlFor="details">Short description <span className="font-normal text-slate-400">(optional)</span></label>
          <textarea id="details" className="input min-h-20" value={form.details} onChange={set('details')} maxLength={1000} />
        </div>
      </Section>

      <Section n={2} title="Venue">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {venues.map((v) => {
            const on = v.id === form.venue_id
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => pickVenue(v.id)}
                className={`rounded-2xl border-2 p-3 text-left transition ${on ? 'shadow-sm' : 'border-slate-200 hover:border-slate-300 dark:border-slate-800'}`}
                style={on ? { borderColor: v.color, background: `${v.color}12` } : undefined}
                aria-pressed={on}
              >
                <div className="flex items-center gap-2 font-semibold"><VenueDot color={v.color} />{v.name}</div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {v.capacity ? `${v.capacity} seats` : 'Capacity not set'}{v.facilities ? ` · ${v.facilities}` : ''}
                </div>
              </button>
            )
          })}
        </div>
      </Section>

      <div ref={dateRef} className="scroll-mt-20">
        <Section n={3} title="Date" hint={venue ? `Dates with dots already have bookings at ${venue.name}.` : 'Choose a venue first.'} disabled={!venue}>
          <MonthPicker
            month={month}
            onMonthChange={setMonth}
            value={form.booking_date}
            onChange={pickDate}
            marks={marks}
            minDate={minDate}
            maxDate={maxDate}
            color={color}
          />
        </Section>
      </div>

      <div ref={timeRef} className="scroll-mt-20">
        <Section
          n={4}
          title="Time"
          hint={form.booking_date ? `${venue?.name} · ${fmtDateLong(form.booking_date)}` : 'Choose a date first.'}
          disabled={!form.booking_date}
        >
          {form.booking_date && (
            <>
              <DayTimeline
                dayStart={dayStart} dayEnd={dayEnd} booked={dayBookings}
                start={form.start_time} end={form.end_time} color={color} clash={clashes.length > 0}
              />

              {dayLoading ? (
                <div className="text-sm text-slate-500">Checking existing bookings…</div>
              ) : dayBookings.length === 0 ? (
                <div className="alert-ok">{venue?.name} is free all day ({fmtTime(dayStart)} – {fmtTime(dayEnd)}).</div>
              ) : (
                <div className="space-y-1.5">
                  <div className="text-sm font-medium">Already booked on this day:</div>
                  {dayBookings.map((b) => (
                    <div key={b.id} className="rounded-xl bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">
                      <div className="flex flex-wrap items-center justify-between gap-x-2">
                        <b>{fmtRange(b.start_time, b.end_time)}</b>
                        {b.status === 'pending' && <span className="text-xs text-amber-700 dark:text-amber-300">Awaiting approval — held</span>}
                      </div>
                      <div className="text-slate-600 dark:text-slate-300">{b.department} · {b.title}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label" htmlFor="start">Start time</label>
                  <select id="start" className="input" value={form.start_time} onChange={(e) => pickStart(e.target.value)} required>
                    <option value="">Select</option>
                    {startOptions.map((t) => (
                      <option key={t} value={t} disabled={startTaken(t)}>{fmtTime(t)}{startTaken(t) ? ' — booked' : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="end">End time</label>
                  <select id="end" className="input" value={form.end_time} onChange={set('end_time')} required disabled={!form.start_time}>
                    <option value="">Select</option>
                    {endOptions.map((t) => <option key={t} value={t}>{fmtTime(t)}</option>)}
                  </select>
                </div>
              </div>

              {clashes.length > 0 ? (
                <div className="alert-error">
                  {clashes.map((b) => (
                    <div key={b.id}><b>{venue?.name}</b> is booked {fmtRange(b.start_time, b.end_time)} by <b>{b.department}</b> ({b.title}).</div>
                  ))}
                  {buffer > 0 && <div className="mt-1">A {buffer}-minute gap is required between events.</div>}
                  <div className="mt-1">Pick a time that doesn't overlap.</div>
                </div>
              ) : form.start_time && form.end_time ? (
                <div className="alert-ok">✓ {fmtRange(form.start_time, form.end_time)} is available.</div>
              ) : null}
            </>
          )}
        </Section>
      </div>

      <Section n={5} title="Contact and requirements">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="fname">Faculty in-charge</label>
            <input id="fname" className="input" value={form.faculty_name} onChange={set('faculty_name')} required />
          </div>
          <div>
            <label className="label" htmlFor="participants">Expected participants <span className="font-normal text-slate-400">(optional)</span></label>
            <input id="participants" type="number" min="1" inputMode="numeric" className="input" value={form.participants} onChange={set('participants')} />
            {venue?.capacity && Number(form.participants) > venue.capacity && (
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">More than {venue.name}'s {venue.capacity} seats.</p>
            )}
          </div>
          <div>
            <label className="label" htmlFor="fphone">Phone</label>
            <input id="fphone" inputMode="numeric" maxLength={10} className="input" value={form.faculty_phone}
              onChange={(e) => set('faculty_phone')(e.target.value.replace(/\D/g, ''))} required />
          </div>
          <div>
            <label className="label" htmlFor="femail">Email</label>
            <input id="femail" type="email" className="input" value={form.faculty_email} onChange={set('faculty_email')} required />
            <p className="mt-1 text-xs text-slate-500">Also receives the confirmation mail.</p>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="req">Special requirements <span className="font-normal text-slate-400">(optional)</span></label>
          <textarea id="req" className="input min-h-20" value={form.requirements} onChange={set('requirements')} placeholder="Projector, mic, AC, chairs…" />
        </div>
      </Section>

      {error && <div className="alert-error">{error}</div>}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {editId && <Link to="/my-bookings" className="btn-ghost">Cancel</Link>}
        <button className="btn-primary sm:min-w-48" disabled={busy || clashes.length > 0}>
          {busy ? 'Submitting…' : editId ? 'Save changes' : 'Submit for approval'}
        </button>
      </div>
    </form>
  )
}
