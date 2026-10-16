-- Move helper functions out of the exposed API schema and lock down trigger functions
-- (Supabase security advisor: SECURITY DEFINER functions callable via /rest/v1/rpc)

create schema if not exists private;
grant usage on schema private to anon, authenticated;

-- RLS policies reference these by OID, so they keep working after the move
alter function public.is_admin()            set schema private;
alter function public.is_approved_user()    set schema private;
alter function public.next_booking_ref(date) set schema private;

-- Trigger functions are never called directly
revoke execute on function public.handle_new_user()       from public, anon, authenticated;
revoke execute on function public.guard_profile_update()  from public, anon, authenticated;
revoke execute on function public.before_booking_insert() from public, anon, authenticated;
revoke execute on function public.before_booking_update() from public, anon, authenticated;
revoke execute on function public.log_booking_change()    from public, anon, authenticated;

-- Re-point function bodies at the private helpers
create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if private.is_admin() or auth.uid() is null then
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

create or replace function public.before_booking_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  s public.settings;
begin
  select * into s from public.settings where id;

  if not private.is_admin() then
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
    new.ref_no := private.next_booking_ref(new.booking_date);
    new.approved_by := auth.uid();
    new.approved_at := now();
  end if;
  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.before_booking_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  new.id      := old.id;
  new.created_at := old.created_at;

  if new.end_time <= new.start_time then
    raise exception 'End time must be after start time';
  end if;

  if private.is_admin() then
    if new.status = 'approved' and old.status = 'pending' then
      new.approved_by := auth.uid();
      new.approved_at := now();
      if new.ref_no is null then
        new.ref_no := private.next_booking_ref(new.booking_date);
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
