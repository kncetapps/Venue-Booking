import { Link } from 'react-router-dom'
import BookingCalendar from '../components/BookingCalendar'

export default function Calendar() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Venue calendar</h1>
          <p className="text-slate-500">Every booking across all halls. Tap a date to see who has booked what.</p>
        </div>
        <Link to="/book" className="btn-primary">+ New booking</Link>
      </div>
      <BookingCalendar />
    </div>
  )
}
