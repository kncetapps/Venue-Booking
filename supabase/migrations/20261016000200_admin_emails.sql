-- Emails listed here become approved admins as soon as they sign up
-- (they still have to verify their email before they can log in).
create table public.admin_emails (
  email      text primary key check (email = lower(email)),
  added_at   timestamptz not null default now()
);
alter table public.admin_emails enable row level security;
create policy "admin emails admin" on public.admin_emails for all
  using (private.is_admin()) with check (private.is_admin());

insert into public.admin_emails (email) values ('kncetapps@gmail.com');

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  is_listed boolean := exists (select 1 from public.admin_emails where email = lower(new.email));
begin
  insert into public.profiles (id, name, email, phone, department, role, status)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1)),
    new.email,
    nullif(trim(new.raw_user_meta_data ->> 'phone'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'department'), ''),
    case when is_listed then 'admin'::public.user_role else 'user'::public.user_role end,
    case when is_listed then 'approved'::public.profile_status else 'pending'::public.profile_status end
  );
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
