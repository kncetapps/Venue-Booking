# Venue Booking System

Institute event venue booking app for Kongunadu College of Engineering and Technology.
Departments book seminar halls and auditoriums; the admin approves; confirmation mails go out automatically.

**Stack:** React + Vite + Tailwind CSS · Supabase (Postgres, Auth, RLS, Edge Functions) · Vercel · PWA (Android via TWA later)

## Build status

| Phase | Scope | Status |
|---|---|---|
| 1. Foundation | Tables, clash guard, security rules, seed data; sign-up → email verify → admin approval → login; forgot password; admin Users page | ✅ Applied to Supabase |
| 2. Booking core | Booking form (venue → date → time, live clash check), calendar with day details, My Bookings (edit / withdraw / cancel request) | ✅ Live |
| 3. Admin + mails | Approve/reject bookings and cancel requests ✅, Halls & Masters ✅, booking history ✅; Gmail SMTP mails with PDF ⏳ (needs college Gmail + App Password) | 🟡 |
| 4. Reports + Android | Reports: month / date range, hall, department, event type, status filters; PDF + Excel export ✅; PWA, Play Store ⏳ | 🟡 |

## Database

`supabase/migrations/20261016000000_foundation.sql` creates:

- `departments`, `event_types`, `venues` — admin-editable masters. Current lists (migration `…0500_update_masters`): departments CSE, IT, Mech, BME, Agri, AIDS, Civil, EEE, ECE; halls Seminar Hall 1 (Ground Floor), Seminar Hall 2 (First Floor), Board Room (First Floor), Seminar Hall 4 (Fourth Floor), Open Auditorium
- `profiles` — one per login; `role` (admin/user), `status` (pending/approved/rejected/inactive)
- `bookings` — with a **Postgres exclusion constraint** (`no_overlapping_bookings`) so no two Pending / Approved / Cancel-requested bookings can overlap on the same venue, even if submitted at the same second. Back-to-back slots (12:00 end, 12:00 start) are allowed.
- `booking_logs` — automatic history of every create / status change / reschedule / edit
- `settings` — college name, signature line, working hours (default 08:00–18:00), buffer, how far ahead bookings are allowed
- Reference numbers `VB-2026-0001` are issued gaplessly when a booking is approved.

Row-level security: users see the shared calendar, create bookings only once approved, edit/withdraw only their own Pending bookings, and can only move their own Approved booking to Cancel Requested (with a reason). Admins can do everything.

## Supabase setup (once)

1. **SQL Editor** → run the migration file (or apply it with the Supabase CLI).
2. **Authentication → Sign In / Providers → Email**: keep *Confirm email* ON.
3. **Authentication → URL Configuration**: Site URL = the Vercel URL; add `https://<vercel-url>/**` and `http://localhost:5173/**` to Redirect URLs.
4. **Admins**: emails in `public.admin_emails` become approved admins as soon as they sign up (after email verification). `kncetapps@gmail.com` is pre-listed. To add another:
   ```sql
   insert into public.admin_emails (email) values ('someone@example.com');
   ```
   An existing user can also be made admin from the app's Users page.
5. (Phase 3) **Authentication → Emails → SMTP**: Gmail SMTP (`smtp.gmail.com`, port 465, the college Gmail + App Password) so verification mails come from the college address.

## Local development

```bash
cp .env.example .env      # fill in the project URL and the publishable (anon) key
npm install
npm run dev
```

## Deploy

Vercel → import this repo → framework *Vite* → add env vars `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` → deploy. Every push to `main` redeploys. `vercel.json` rewrites all routes to `index.html` for client-side routing.
