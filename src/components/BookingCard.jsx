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
export default function BookingCard({ b, showDate = false, showContact = true, actions = null, highlight = false }) {
  return (
    <article
      className={`rounded-2xl border bg-white p-4 dark:bg-slate-900 ${highlight ? 'border-brand-500 ring-2 ring-brand-100 dark:ring-brand-800' : 'border-slate-200 dark:border-slate-800'}`}
      style={{ borderLeft: `5px solid ${b.venue_color}` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: b.venue_color }}>
            <VenueDot color={b.venue_color} /> {b.venue_name}
          </div>
          <h3 className="mt-1 text-[15px] leading-snug font-semibold">{b.title}</h3>
          <div className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
            {showDate && <>{fmtDate(b.booking_date)} · </>}
            {fmtRange(b.start_time, b.end_time)}
          </div>
        </div>
        <StatusBadge status={b.status} />
      </div>

      <dl className="mt-3 space-y-1.5">
        <Row label="Department">{b.department}</Row>
        <Row label="Event type">{b.event_type}</Row>
        <Row label="Details">{b.details}</Row>
        <Row label="In-charge">{b.faculty_name}</Row>
        {showContact && <Row label="Phone">{b.faculty_phone && <a className="text-brand-600 dark:text-blue-300" href={`tel:${b.faculty_phone}`}>{b.faculty_phone}</a>}</Row>}
        {showContact && <Row label="Email">{b.faculty_email && <a className="text-brand-600 dark:text-blue-300" href={`mailto:${b.faculty_email}`}>{b.faculty_email}</a>}</Row>}
        <Row label="Participants">{b.participants}</Row>
        <Row label="Requirements">{b.requirements}</Row>
        <Row label="Reference">{b.ref_no}</Row>
        <Row label="Cancel reason">{b.cancel_reason}</Row>
        <Row label="Admin remark">{b.admin_remark}</Row>
      </dl>

      {actions && <div className="mt-4 flex flex-wrap gap-2">{actions}</div>}
    </article>
  )
}
