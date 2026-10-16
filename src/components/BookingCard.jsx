import { STATUS, fmtDate, fmtRange } from '../lib/format'

export function StatusBadge({ status }) {
  const s = STATUS[status] || { label: status, cls: 'bg-slate-100 text-slate-700' }
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}>{s.label}</span>
}

export function VenueDot({ color, className = '' }) {
  return <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${className}`} style={{ background: color }} />
}

const Row = ({ label, children }) =>
  children ? (
    <div className="flex gap-3 text-sm">
      <dt className="w-24 shrink-0 text-slate-500">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  ) : null

/**
 * Full details of one booking. `b` is a row from booking_calendar (venue_name, venue_color…).
 * `showDate` adds the date line (lists); the day panel already shows it.
 */
export default function BookingCard({ b, showDate = false, showContact = true, actions = null, highlight = false, showBooker = false }) {
  return (
    <article
      className={`rounded-2xl border bg-white p-4 dark:bg-slate-900 ${highlight ? 'border-brand-500 ring-2 ring-brand-100 dark:ring-brand-800' : 'border-slate-200 dark:border-slate-800'}`}
      style={{ borderLeft: `5px solid ${b.venue_color}` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: b.venue_color }}>
            <VenueDot color={b.venue_color} /> {b.venue_name}
            {b.venue_location && b.venue_location !== b.venue_name && (
              <span className="font-normal text-slate-500">· {b.venue_location}</span>
            )}
          </div>
          <h3 className="mt-1 text-[15px] leading-snug font-semibold">{b.title}</h3>
          <div className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
            {showDate && <>{fmtDate(b.booking_date)} · </>}
            {fmtRange(b.start_time, b.end_time)}
          </div>
        </div>
        <StatusBadge status={b.status} />
      </div>

      {showBooker && (
        <div className="mt-3 rounded-xl bg-brand-50 px-3 py-2.5 text-sm ring-1 ring-brand-100 dark:bg-slate-800 dark:ring-slate-700">
          <div className="text-xs font-semibold tracking-wide text-brand-700 uppercase dark:text-blue-300">Entry made by</div>
          <div className="mt-0.5 font-semibold">
            {b.booked_by_name || 'Unknown user'}
            {b.booked_by_dept && <span className="font-normal text-slate-600 dark:text-slate-300"> · {b.booked_by_dept}</span>}
          </div>
          <div className="text-slate-600 dark:text-slate-300">
            {b.booked_by_email && <a className="text-brand-600 dark:text-blue-300" href={`mailto:${b.booked_by_email}`}>{b.booked_by_email}</a>}
            {b.booked_by_phone && <> · <a className="text-brand-600 dark:text-blue-300" href={`tel:${b.booked_by_phone}`}>{b.booked_by_phone}</a></>}
          </div>
          <div className="text-xs text-slate-500">
            Submitted {new Date(b.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
          </div>
        </div>
      )}

      <dl className="mt-3 space-y-1.5">
        <Row label="Department">{b.department}</Row>
        <Row label="Event type">{b.event_type}</Row>
        <Row label="Details">{b.details}</Row>
        <Row label="In-charge">{b.faculty_name}</Row>
        {showContact && <Row label="Phone">{b.faculty_phone && <a className="text-brand-600 dark:text-blue-300" href={`tel:${b.faculty_phone}`}>{b.faculty_phone}</a>}</Row>}
        {showContact && <Row label="Email">{b.faculty_email && <a className="text-brand-600 dark:text-blue-300" href={`mailto:${b.faculty_email}`}>{b.faculty_email}</a>}</Row>}
        <Row label="Participants">{b.participants}</Row>
        <Row label="Requirements">{b.requirements}</Row>
        {!showBooker && <Row label="Entered by">{b.booked_by_name && `${b.booked_by_name}${b.booked_by_dept ? ` (${b.booked_by_dept})` : ''}`}</Row>}
        <Row label="Reference">{b.ref_no}</Row>
        <Row label="Approved by">{b.status !== 'pending' && b.approved_by_name}</Row>
        <Row label="Cancel reason">{b.cancel_reason}</Row>
        <Row label="Admin remark">{b.admin_remark}</Row>
      </dl>

      {actions && <div className="mt-4 flex flex-wrap gap-2">{actions}</div>}
    </article>
  )
}
