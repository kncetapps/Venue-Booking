-- =====================================================================
-- Venue Booking System — Phase 1 foundation
-- Kongunadu College of Engineering and Technology
-- Tables, clash guard, row-level security, audit log, seed data.
-- =====================================================================

create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
create type public.user_role      as enum ('admin', 'user');
create type public.profile_status as enum ('pending', 'approved', 'rejected', 'inactive');
create type public.booking_status as enum (
  'pending', 'approved', 'rejected', 'withdrawn', 'cancel_requested', 'cancelled'
);

-- ---------------------------------------------------------------------
-- Masters (all admin-editable)
-- ---------------------------------------------------------------------
create table public.departments (
  id          bigint generated always as identity primary key,
  short_name  text not null unique,
  full_name   text not null,
  active      boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

create table public.event_types (
  id          bigint generated always as identity primary key,
  name        text not null unique,
  active      boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

create table public.venues (
  id          bigint generated always as identity primary key,
  name        text not null unique,
  capacity    int,
  facilities  text,
  color       text not null default '#2563eb',   -- one colour per venue across calendar/lists/reports
  active      boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------
create table public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  name             text not null,
  email            text not null,
  phone            text,
  department       text,                 -- free text, matches departments.short_name when picked from list
  role             public.user_role not null default 'user',
  status           public.profile_status not null default 'pending',
  status_remark    text,                 -- rejection / deactivation reason
  status_changed_by uuid references public.profiles (id),
  status_changed_at timestamptz,
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Settings (single row)
-- ---------------------------------------------------------------------
create table public.settings (
  id                   boolean primary key default true check (id),
  college_name         text not null default 'Kongunadu College of Engineering and Technology (Autonomous)',
  college_address      text not null default 'Thottiam, Tiruchirappalli, Tamil Nadu',
  logo_url             text,
  signature_line       text not null default 'Approved by Admin, Kongunadu College of Engineering and Technology',
  mail_from_name       text not null default 'KNCET Venue Booking',
  buffer_minutes       int  not null default 0,
  day_start            time not null default '08:00',
  day_end              time not null default '18:00',
  max_days_ahead       int  not null default 180,
  updated_at           timestamptz not null default now()
);
insert into public.settings default values;

-- ---------------------------------------------------------------------
-- Bookings
-- ---------------------------------------------------------------------
-- Gapless reference numbers per year (VB-2026-0001), issued when a booking is approved
create table public.booking_ref_counters (
  year     int primary key,
  last_no  int not null default 0
);

create table public.bookings (
  id                   bigint generated always as identity primary key,
  ref_no               text unique,
  user_id              uuid not null references public.profiles (id),
  department           text not null,
  event_type           text not null,
  title                text not null,
  details              text,
  venue_id             bigint not null references public.venues (id),
  booking_date         date not null,
  start_time           time not null,
  end_time             time not null,
  participants         int check (participants is null or participants > 0),
  faculty_name         text not null,
  faculty_phone        text not null check (faculty_phone ~ '^[0-9]{10}$'),
  faculty_email        text not null check (faculty_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  requirements         text,
  status               public.booking_status not null default 'pending',
  cancel_reason        text,
  cancel_requested_at  timestamptz,
  admin_remark         text,
  approved_by          uuid references public.profiles (id),
  approved_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  -- half-open range [start, end) so back-to-back bookings (12:00 end / 12:00 start) are allowed
  slot tsrange generated always as (
    tsrange(booking_date + start_time, booking_date + end_time, '[)')
  ) stored,

  constraint end_after_start check (end_time > start_time),

  -- The hard clash guard: no two live bookings may overlap on the same venue.
  -- Rejected, withdrawn and cancelled rows free the slot; cancel_requested still holds it.
  constraint no_overlapping_bookings exclude using gist (
    venue_id with =,
    slot     with &&
  ) where (status in ('pending', 'approved', 'cancel_requested'))
);

create index bookings_date_idx   on public.bookings (booking_date);
create index bookings_user_idx   on public.bookings (user_id);
create index bookings_status_idx on public.bookings (status);

-- ---------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------
create table public.booking_logs (
  id          bigint generated always as identity primary key,
  booking_id  bigint not null references public.bookings (id) on delete cascade,
  action      text not null,
  from_status public.booking_status,
  to_status   public.booking_status,
  by_user     uuid references public.profiles (id),
  remark      text,
  at          timestamptz not null default now()
);
create index booking_logs_booking_idx on public.booking_logs (booking_id);

-- =====================================================================
-- Helper functions
-- =====================================================================
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and status = 'approved'
  );
$$;

create or replace function public.is_approved_user()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'approved'
  );
$$;

create or replace function public.next_booking_ref(d date)
returns text language plpgsql security definer set search_path = public as $$
declare
  y int := extract(year from d)::int;
  n int;
begin
  insert into public.booking_ref_counters as c (year, last_no) values (y, 1)
  on conflict (year) do update set last_no = c.last_no + 1
  returning last_no into n;
  return 'VB-' || y || '-' || lpad(n::text, 4, '0');
end;
$$;
revoke execute on function public.next_booking_ref(date) from public, anon, authenticated;

-- =====================================================================
-- Triggers
-- =====================================================================

-- New auth user -> profile row (status pending until admin approves)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email, phone, department)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1)),
    new.email,
    nullif(trim(new.raw_user_meta_data ->> 'phone'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'department'), '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Non-admins may edit their own name/phone/department only
create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() or auth.uid() is null then
    if new.status is distinct from old.status then
      new.status_changed_by := auth.uid();
      new.status_changed_at := now();
    end if;
    return new;
  end if;

  if new.id <> auth.uid()
     or new.role is distinct from old.role
     or new.status is distinct from old.status
     or new.status_remark is distinct from old.status_remark
     or new.email is distinct from old.email then
    raise exception 'Only an admin can change role, status or email';
  end if;
  return new;
end;
$$;

create trigger profiles_guard
  before update on public.profiles
  for each row execute function public.guard_profile_update();

-- Booking insert: set owner, status, reference number; validate rules
create or replace function public.before_booking_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  s public.settings;
begin
  select * into s from public.settings where id;

  if not public.is_admin() then
    new.user_id := auth.uid();
    new.status  := 'pending';
    new.admin_remark := null;
    new.approved_by  := null;
    new.approved_at  := null;

    if new.booking_date < current_date then
      raise exception 'Booking date cannot be in the past';
    end if;
    if new.booking_date > current_date + s.max_days_ahead then
      raise exception 'Bookings are allowed only up to % days ahead', s.max_days_ahead;
    end if;
    if new.start_time < s.day_start or new.end_time > s.day_end then
      raise exception 'Bookings must be between % and %', s.day_start, s.day_end;
    end if;
  end if;

  if new.end_time <= new.start_time then
    raise exception 'End time must be after start time';
  end if;

  if not exists (select 1 from public.venues where id = new.venue_id and active) then
    raise exception 'This venue is not available for booking';
  end if;

  new.ref_no := null;
  if new.status = 'approved' then
    new.ref_no := public.next_booking_ref(new.booking_date);
    new.approved_by := auth.uid();
    new.approved_at := now();
  end if;
  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$$;

create trigger bookings_before_insert
  before insert on public.bookings
  for each row execute function public.before_booking_insert();

-- Booking update: enforce the user-side state machine
--   pending          -> pending (edit details) | withdrawn
--   approved         -> cancel_requested (reason required)
-- Admins may do anything (approve, reject, reschedule, cancel, decide cancel requests).
create or replace function public.before_booking_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  new.id      := old.id;
  new.created_at := old.created_at;

  if new.end_time <= new.start_time then
    raise exception 'End time must be after start time';
  end if;

  if public.is_admin() then
    if new.status = 'approved' and old.status = 'pending' then
      new.approved_by := auth.uid();
      new.approved_at := now();
      if new.ref_no is null then
        new.ref_no := public.next_booking_ref(new.booking_date);
      end if;
    end if;
    return new;
  end if;

  if old.user_id <> auth.uid() then
    raise exception 'You can change only your own bookings';
  end if;

  new.user_id      := old.user_id;
  new.ref_no       := old.ref_no;
  new.admin_remark := old.admin_remark;
  new.approved_by  := old.approved_by;
  new.approved_at  := old.approved_at;

  if old.status = 'pending' and new.status = 'pending' then
    return new;                                   -- editing a pending request
  elsif old.status = 'pending' and new.status = 'withdrawn' then
    return new;
  elsif old.status = 'approved' and new.status = 'cancel_requested' then
    if coalesce(trim(new.cancel_reason), '') = '' then
      raise exception 'A reason is required to request cancellation';
    end if;
    -- details are frozen once approved
    new.department := old.department;   new.event_type := old.event_type;
    new.title      := old.title;        new.details    := old.details;
    new.venue_id   := old.venue_id;     new.booking_date := old.booking_date;
    new.start_time := old.start_time;   new.end_time   := old.end_time;
    new.participants := old.participants;
    new.faculty_name := old.faculty_name; new.faculty_phone := old.faculty_phone;
    new.faculty_email := old.faculty_email; new.requirements := old.requirements;
    new.cancel_requested_at := now();
    return new;
  end if;

  raise exception 'This change is not allowed (booking is %)', old.status;
end;
$$;

create trigger bookings_before_update
  before update on public.bookings
  for each row execute function public.before_booking_update();

-- Audit trail: every insert and status / schedule change
create or replace function public.log_booking_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.booking_logs (booking_id, action, to_status, by_user)
    values (new.id, 'created', new.status, auth.uid());
  elsif new.status is distinct from old.status then
    insert into public.booking_logs (booking_id, action, from_status, to_status, by_user, remark)
    values (new.id, 'status_changed', old.status, new.status, auth.uid(),
            coalesce(case when new.status = 'cancel_requested' then new.cancel_reason end,
                     new.admin_remark));
  elsif (new.venue_id, new.booking_date, new.start_time, new.end_time)
        is distinct from (old.venue_id, old.booking_date, old.start_time, old.end_time) then
    insert into public.booking_logs (booking_id, action, from_status, to_status, by_user, remark)
    values (new.id, 'rescheduled', old.status, new.status, auth.uid(),
            format('%s %s-%s -> %s %s-%s', old.booking_date, old.start_time, old.end_time,
                   new.booking_date, new.start_time, new.end_time));
  elsif row(new.*) is distinct from row(old.*) then
    insert into public.booking_logs (booking_id, action, from_status, to_status, by_user)
    values (new.id, 'edited', old.status, new.status, auth.uid());
  end if;
  return new;
end;
$$;

create trigger bookings_log
  after insert or update on public.bookings
  for each row execute function public.log_booking_change();

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.departments  enable row level security;
alter table public.event_types  enable row level security;
alter table public.venues       enable row level security;
alter table public.profiles     enable row level security;
alter table public.settings     enable row level security;
alter table public.bookings     enable row level security;
alter table public.booking_logs enable row level security;
alter table public.booking_ref_counters enable row level security;   -- no policies: internal only

-- Masters: readable by everyone (sign-up page needs departments before login); admin writes
create policy "masters read"  on public.departments for select using (true);
create policy "masters admin" on public.departments for all using (public.is_admin()) with check (public.is_admin());
create policy "masters read"  on public.event_types for select using (true);
create policy "masters admin" on public.event_types for all using (public.is_admin()) with check (public.is_admin());
create policy "masters read"  on public.venues      for select using (true);
create policy "masters admin" on public.venues      for all using (public.is_admin()) with check (public.is_admin());

-- Settings: any signed-in user reads; admin updates
create policy "settings read"  on public.settings for select to authenticated using (true);
create policy "settings admin" on public.settings for update using (public.is_admin()) with check (public.is_admin());

-- Profiles: own row or admin
create policy "profile read own"   on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "profile update own" on public.profiles for update using (id = auth.uid() or public.is_admin())
                                                       with check (id = auth.uid() or public.is_admin());

-- Bookings: every approved user sees the shared calendar
create policy "bookings read"   on public.bookings for select using (public.is_approved_user());
create policy "bookings insert" on public.bookings for insert with check (public.is_approved_user());
create policy "bookings update" on public.bookings for update
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());
create policy "bookings delete" on public.bookings for delete using (public.is_admin());

-- Logs: admin, or the owner of the booking
create policy "logs read" on public.booking_logs for select using (
  public.is_admin()
  or exists (select 1 from public.bookings b where b.id = booking_id and b.user_id = auth.uid())
);

-- Booker names for the calendar without exposing the profiles table
create or replace view public.booking_calendar
with (security_invoker = true) as
select b.id, b.ref_no, b.department, b.event_type, b.title, b.details,
       b.venue_id, v.name as venue_name, v.color as venue_color,
       b.booking_date, b.start_time, b.end_time, b.participants,
       b.faculty_name, b.faculty_phone, b.faculty_email, b.requirements,
       b.status, b.user_id, b.created_at
from public.bookings b
join public.venues v on v.id = b.venue_id;

-- =====================================================================
-- Seed data
-- =====================================================================
insert into public.departments (short_name, full_name, sort_order) values
  ('CSE',   'Computer Science and Engineering', 1),
  ('IT',    'Information Technology', 2),
  ('ECE',   'Electronics and Communication Engineering', 3),
  ('EEE',   'Electrical and Electronics Engineering', 4),
  ('MECH',  'Mechanical Engineering', 5),
  ('CIVIL', 'Civil Engineering', 6),
  ('AI&DS', 'Artificial Intelligence and Data Science', 7),
  ('AI&ML', 'Artificial Intelligence and Machine Learning', 8),
  ('CSBS',  'Computer Science and Business Systems', 9);

insert into public.event_types (name, sort_order) values
  ('Seminar', 1), ('Workshop', 2), ('Symposium', 3), ('Hackathon', 4),
  ('Conference', 5), ('Hands-on Training', 6), ('Inauguration', 7);

insert into public.venues (name, color, sort_order) values
  ('Seminar Hall 1',     '#2563eb', 1),
  ('Seminar Hall 2',     '#059669', 2),
  ('Seminar Hall 3',     '#d97706', 3),
  ('Seminar Hall 4',     '#7c3aed', 4),
  ('Auditorium',         '#dc2626', 5),
  ('Indoor Auditorium',  '#0891b2', 6);
