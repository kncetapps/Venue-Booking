-- Booking details panels also show admin remarks and cancellation reasons
create or replace view public.booking_calendar
with (security_invoker = true) as
select b.id, b.ref_no, b.department, b.event_type, b.title, b.details,
       b.venue_id, v.name as venue_name, v.color as venue_color,
       b.booking_date, b.start_time, b.end_time, b.participants,
       b.faculty_name, b.faculty_phone, b.faculty_email, b.requirements,
       b.status, b.user_id, b.created_at,
       b.admin_remark, b.cancel_reason, b.cancel_requested_at, b.approved_at, b.updated_at
from public.bookings b
join public.venues v on v.id = b.venue_id;

-- Live calendar refresh (row-level security still applies to what each client receives)
alter publication supabase_realtime add table public.bookings;
