-- Who entered and who approved each booking, stored on the booking itself so every
-- viewer (calendar, admin approvals, confirmation copy) can show it without reading profiles.
alter table public.bookings
  add column if not exists booked_by_name  text,
  add column if not exists booked_by_email text,
  add column if not exists booked_by_dept  text,
  add column if not exists booked_by_phone text,
  add column if not exists approved_by_name text;

create or replace function public.set_booking_people()
returns trigger language plpgsql security definer set search_path = public as $$
declare p public.profiles;
begin
  if tg_op = 'INSERT' or new.user_id is distinct from old.user_id then
    select * into p from public.profiles where id = new.user_id;
    new.booked_by_name  := p.name;
    new.booked_by_email := p.email;
    new.booked_by_dept  := p.department;
    new.booked_by_phone := p.phone;
  else
    new.booked_by_name  := old.booked_by_name;
    new.booked_by_email := old.booked_by_email;
    new.booked_by_dept  := old.booked_by_dept;
    new.booked_by_phone := old.booked_by_phone;
  end if;

  if new.approved_by is null then
    new.approved_by_name := null;
  elsif tg_op = 'INSERT' or new.approved_by is distinct from old.approved_by then
    select name into new.approved_by_name from public.profiles where id = new.approved_by;
  else
    new.approved_by_name := old.approved_by_name;
  end if;
  return new;
end;
$$;
revoke execute on function public.set_booking_people() from public, anon, authenticated;

-- Fires after bookings_before_insert / bookings_before_update (triggers run in name order)
create trigger bookings_people
  before insert or update on public.bookings
  for each row execute function public.set_booking_people();

create or replace view public.booking_calendar
with (security_invoker = true) as
select b.id, b.ref_no, b.department, b.event_type, b.title, b.details,
       b.venue_id, v.name as venue_name, v.color as venue_color,
       b.booking_date, b.start_time, b.end_time, b.participants,
       b.faculty_name, b.faculty_phone, b.faculty_email, b.requirements,
       b.status, b.user_id, b.created_at,
       b.admin_remark, b.cancel_reason, b.cancel_requested_at, b.approved_at, b.updated_at,
       v.location as venue_location,
       b.booked_by_name, b.booked_by_email, b.booked_by_dept, b.booked_by_phone, b.approved_by_name
from public.bookings b
join public.venues v on v.id = b.venue_id;
