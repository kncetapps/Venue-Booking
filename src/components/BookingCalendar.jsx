import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import listPlugin from '@fullcalendar/list'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { LIVE_STATUSES, fmtDateLong, toISODate, todayISO } from '../lib/format'
import { supabase } from '../lib/supabase'
import { useMasters } from '../lib/useMasters'
import BookingCard, { VenueDot } from './BookingCard'
import ConfirmationButton from './ConfirmationButton'

const isPhone = () => window.matchMedia('(max-width: 767px)').matches

/** The shared calendar of every venue's live bookings, with a day-details panel. */
export default function BookingCalendar({ compact = false }) {
  const { profile, isAdmin } = useAuth()
  const { venues } = useMasters()
  const calRef = useRef(null)
  const [venueFilter, setVenueFilter] = useState(null) // null = all venues
  const [rows, setRows] = useState([])
  const [range, setRange] = useState(null)
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [phone, setPhone] = useState(isPhone)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const on = () => setPhone(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  const load = useCallback(async () => {
    if (!range) return
    let q = supabase.from('booking_calendar').select('*')
      .gte('booking_date', range.from).lt('booking_date', range.to).in('status', LIVE_STATUSES)
      .order('booking_date').order('start_time')
    if (venueFilter) q = q.eq('venue_id', venueFilter)
    const { data } = await q
    setRows(data || [])
  }, [range, venueFilter])

  useEffect(() => { load() }, [load])

  // Keep the calendar fresh when anyone books / an admin approves
  useEffect(() => {
    const ch = supabase.channel('bookings-calendar')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  const events = useMemo(() => rows.map((b) => {
    const approved = b.status === 'approved'
    return {
      id: String(b.id),
      title: `${b.department} · ${b.title}`,
      start: `${b.booking_date}T${b.start_time}`,
      end: `${b.booking_date}T${b.end_time}`,
      backgroundColor: approved ? b.venue_color : '#ffffff',
      borderColor: b.venue_color,
      textColor: approved ? '#ffffff' : b.venue_color,
      classNames: [b.status === 'cancel_requested' ? 'vb-cancel-req' : '', approved ? '' : 'vb-pending'],
      extendedProps: { booking: b },
    }
  }), [rows])

  const dayRows = selectedDate ? rows.filter((b) => b.booking_date === selectedDate) : []

  const openDate = (iso, id = null) => { setSelectedDate(iso); setSelectedId(id) }

  return (
    <div className="space-y-3">
      {/* Venue filter */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <button
          onClick={() => setVenueFilter(null)}
          className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium ${!venueFilter ? 'border-brand-700 bg-brand-700 text-white' : 'border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900'}`}
        >All venues</button>
        {venues.map((v) => {
          const on = venueFilter === v.id
          return (
            <button
              key={v.id}
              onClick={() => setVenueFilter(on ? null : v.id)}
              className="flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium"
              style={on ? { background: v.color, borderColor: v.color, color: '#fff' } : { borderColor: `${v.color}66` }}
            >
              {!on && <VenueDot color={v.color} />}{v.name}
            </button>
          )
        })}
      </div>

      <div className="vb-calendar card p-2 sm:p-4">
        <FullCalendar
          ref={calRef}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={phone
            ? { left: 'prev,next', center: 'title', right: 'today' }
            : { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek' }}
          footerToolbar={phone ? { center: 'dayGridMonth,timeGridDay,listWeek' } : false}
          buttonText={{ today: 'Today', month: 'Month', week: 'Week', day: 'Day', list: 'List' }}
          firstDay={1}
          height={compact ? 'auto' : phone ? 'auto' : 720}
          dayMaxEvents={phone ? 2 : 3}
          slotMinTime="07:00:00"
          slotMaxTime="20:00:00"
          allDaySlot={false}
          nowIndicator
          eventDisplay="block"
          eventTimeFormat={{ hour: 'numeric', minute: '2-digit', meridiem: 'short' }}
          slotLabelFormat={{ hour: 'numeric', meridiem: 'short' }}
          events={events}
          datesSet={(info) => setRange({ from: toISODate(info.start), to: toISODate(info.end) })}
          dateClick={(info) => openDate(toISODate(info.date))}
          eventClick={(info) => {
            const b = info.event.extendedProps.booking
            openDate(b.booking_date, b.id)
          }}
          moreLinkClick={(info) => { openDate(toISODate(info.date)); return 'none' }}
          dayCellClassNames={(arg) => (toISODate(arg.date) === selectedDate ? ['vb-selected-day'] : [])}
          noEventsContent="No bookings in this period"
        />
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded bg-brand-700" /> Approved</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded border-2 border-brand-700 bg-white" /> Pending approval</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded border-2 border-dashed border-orange-500 bg-white" /> Cancellation requested</span>
        <span>Tap a date for full details.</span>
      </div>

      {/* Day details: side panel on desktop, bottom sheet on phones */}
      {selectedDate && (
        <div className="fixed inset-0 z-40 flex items-end justify-end bg-black/30 md:items-stretch" onClick={() => setSelectedDate(null)}>
          <aside
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[85dvh] w-full flex-col rounded-t-3xl bg-slate-50 shadow-2xl md:max-h-none md:w-[440px] md:rounded-none dark:bg-slate-950"
          >
            <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <div>
                <div className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  {selectedDate === todayISO() ? 'Today' : 'Bookings on'}
                </div>
                <h2 className="text-lg font-bold">{fmtDateLong(selectedDate)}</h2>
                <div className="text-sm text-slate-500">
                  {dayRows.length} booking{dayRows.length === 1 ? '' : 's'}{venueFilter ? ` at ${venues.find((v) => v.id === venueFilter)?.name}` : ''}
                </div>
              </div>
              <button onClick={() => setSelectedDate(null)} className="rounded-lg p-2 text-2xl leading-none hover:bg-slate-200 dark:hover:bg-slate-800" aria-label="Close">×</button>
            </header>
            <div className="flex-1 space-y-3 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              {dayRows.length === 0 ? (
                <div className="card text-slate-500">No bookings — every venue is free{venueFilter ? '' : ' this day'}.</div>
              ) : (
                dayRows.map((b) => (
                  <BookingCard key={b.id} b={b} highlight={b.id === selectedId} showContact showBooker={isAdmin}
                    actions={(isAdmin || b.user_id === profile.id) && b.status === 'approved' ? <ConfirmationButton b={b} /> : null} />
                ))
              )}
              {selectedDate >= todayISO() && (
                <Link to="/book" className="btn-primary w-full">+ New booking</Link>
              )}
              {dayRows.some((b) => b.user_id === profile.id) && (
                <Link to="/my-bookings" className="btn-ghost w-full">Manage my bookings</Link>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
