-- Updated department and hall lists (16 Oct 2026)

-- ---------- Departments: CSE, IT, Mech, BME, Agri, AIDS, Civil, EEE, ECE ----------
-- Rename codes in place so existing profiles/bookings keep matching
update public.departments set short_name = 'Mech'  where short_name = 'MECH';
update public.departments set short_name = 'Civil' where short_name = 'CIVIL';
update public.departments set short_name = 'AIDS'  where short_name = 'AI&DS';
update public.profiles set department = 'Mech'  where department = 'MECH';
update public.profiles set department = 'Civil' where department = 'CIVIL';
update public.profiles set department = 'AIDS'  where department = 'AI&DS';
update public.bookings set department = 'Mech'  where department = 'MECH';
update public.bookings set department = 'Civil' where department = 'CIVIL';
update public.bookings set department = 'AIDS'  where department = 'AI&DS';

-- Not in the new list: switched off (hidden) rather than deleted
update public.departments set active = false, sort_order = 99 where short_name in ('AI&ML', 'CSBS');

insert into public.departments (short_name, full_name) values
  ('BME',  'Biomedical Engineering'),
  ('Agri', 'Agricultural Engineering')
on conflict (short_name) do nothing;

update public.departments d set full_name = v.full_name, sort_order = v.ord, active = true
from (values
  ('CSE',   'Computer Science and Engineering',          1),
  ('IT',    'Information Technology',                    2),
  ('Mech',  'Mechanical Engineering',                    3),
  ('BME',   'Biomedical Engineering',                    4),
  ('Agri',  'Agricultural Engineering',                  5),
  ('AIDS',  'Artificial Intelligence and Data Science',  6),
  ('Civil', 'Civil Engineering',                         7),
  ('EEE',   'Electrical and Electronics Engineering',    8),
  ('ECE',   'Electronics and Communication Engineering', 9)
) as v(short_name, full_name, ord)
where d.short_name = v.short_name;

-- ---------- Halls: floor / location ----------
alter table public.venues add column if not exists location text;

-- Halls no longer in the list: switched off (hidden) rather than deleted
update public.venues set active = false, sort_order = 99 where name in ('Seminar Hall 3', 'Indoor Auditorium');

update public.venues set name = 'Open Auditorium' where name = 'Auditorium';

insert into public.venues (name, color) values ('Board Room', '#d97706')
on conflict (name) do nothing;

update public.venues t set location = v.location, sort_order = v.ord, color = v.color, active = true
from (values
  ('Seminar Hall 1',  'Ground Floor',    1, '#2563eb'),
  ('Seminar Hall 2',  'First Floor',     2, '#059669'),
  ('Board Room',      'First Floor',     3, '#d97706'),
  ('Seminar Hall 4',  'Fourth Floor',    4, '#7c3aed'),
  ('Open Auditorium', 'Open Auditorium', 5, '#dc2626')
) as v(name, location, ord, color)
where t.name = v.name;

-- ---------- Calendar view: add hall location ----------
create or replace view public.booking_calendar
with (security_invoker = true) as
select b.id, b.ref_no, b.department, b.event_type, b.title, b.details,
       b.venue_id, v.name as venue_name, v.color as venue_color,
       b.booking_date, b.start_time, b.end_time, b.participants,
       b.faculty_name, b.faculty_phone, b.faculty_email, b.requirements,
       b.status, b.user_id, b.created_at,
       b.admin_remark, b.cancel_reason, b.cancel_requested_at, b.approved_at, b.updated_at,
       v.location as venue_location
from public.bookings b
join public.venues v on v.id = b.venue_id;
