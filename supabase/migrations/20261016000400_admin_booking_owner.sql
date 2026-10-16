-- Admin bookings default to the admin as owner when no user_id is given
create or replace function public.before_booking_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  s public.settings;
begin
  select * into s from public.settings where id;

  if private.is_admin() then
    new.user_id := coalesce(new.user_id, auth.uid());   -- admin may book on behalf of someone
  else
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
revoke execute on function public.before_booking_insert() from public, anon, authenticated;
