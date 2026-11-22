# Rank Rush - Owner Setup & Operations (Supabase)

This is the onboarding and operations guide for the Supabase-backed Rank Rush
app in this repository. Nothing here deploys anything - deployment is yours.

## Backend facts

- Supabase project: **Rank Rush Event** (free plan, Mumbai ap-south-1), inside
  the existing "Rank Rush" organization. It is a **separate, fresh database** -
  the old "Rank Rush" project and its data are untouched.
- Project URL: https://loiwlyqttlwatjimphks.supabase.co
- Dashboard: https://supabase.com/dashboard/project/loiwlyqttlwatjimphks
- The anon/publishable key in `src/services/supabaseClient.ts` is public by
  design. Every rule is enforced server-side by Postgres RLS and RPCs
  (`supabase/schema.sql`). No secret keys are in this repo.
- Database password is in your Instinct vault ("Supabase Rank Rush Event Postgres").
  It is only needed for direct database connections (e.g. psql); every step in
  this guide runs in the dashboard SQL Editor while you are signed in.
- Schema of record: `supabase/schema.sql`. It now includes the single-row seeds
  (`settings_event`, `admin_quota`) and all columns the app writes - a fresh
  project works after running it once in the SQL editor.

## Auth configuration (deliberate choices)

- **Anonymous sign-ins: ON** - judges join with name + email, no password.
- **Email confirmation: OFF** - Supabase's default email sender is rate-limited
  (about 2 emails/hour), which blocked sign-ups on the old project. With it off,
  accounts sign in immediately. Consequence: a typed email address is NOT
  verified. Admin approval is by authenticated account (UID), never by email
  address alone - approve only requests whose name/email you recognize from the
  Admin Console.
- **Password recovery** emails also go through the rate-limited default sender.
  If you want reliable confirmation/recovery emails, add a free custom SMTP
  sender under Authentication > Emails > SMTP settings, then re-enable
  "Confirm email" under Authentication > Sign In / Providers if you want it.

## First admin (you) - one-time secure binding

There is deliberately NO self-service way to become admin. Binding is a manual
owner step so nobody can claim the seat:

1. Open the app and create your account (Admin Login > Create Admin Account)
   with your own email and password.
2. Supabase dashboard > Authentication > Users: copy your user's UID.
3. SQL Editor, run (replace the two placeholders):

   insert into public.admins (uid, email, name, is_first_admin)
   values ('YOUR_UID', 'you@example.com', 'Your Name', true);
   update public.admin_quota
   set count = 1, first_admin_email = 'you@example.com', first_admin_uid = 'YOUR_UID'
   where id = true;

4. Sign in at Admin Login. You now hold admin seat 1 of 5.

## Adding more admins (up to 5 total)

1. The other person creates an account in the app; their join request appears
   in the Admin Console automatically.
2. You approve it from the join-requests panel. The cap of 5 is enforced by the
   database in one locked transaction - two simultaneous approvals cannot both
   succeed, and a 6th admin is always rejected.
3. Removing an admin frees their seat and clears their old join request, so
   they can request access again from the UI whenever needed. You cannot
   remove yourself or the first admin. A rejected request stays rejected - a
   rejected person needs a new account or a manual reset of their
   `admin_requests` row to `status = 'pending'` (SQL Editor).

## Event operations

- **Judges**: name + email on the Judge page; they can only read/edit their own
  scores while submissions are open and editing is allowed.
- **Projector / live leaderboard**: admin-only, before and after publishing.
- **Publishing**: results become visible to the audience only when an admin
  publishes them; unpublishing revokes access instantly. The audience sees
  aggregate standings only - never judge names, emails or individual scores.
- **Start New Event**: archives the current standings first (Archives panel),
  refuses to run if ratings changed since you opened the panel, then clears
  teams/scores and reopens submissions. Admin accounts carry over.

## Verification status (Nov 22, 2026)

Verified live against this exact backend: 60+ checks covering anon and judge
denial boundaries (Data API tables AND RPCs), five-criteria range/shape
rejection, judge own-score isolation, 5-admin cap including parallel-approval
atomicity and seat freeing, publish/unpublish audience visibility, archive/reset
lifecycle with stale-snapshot rejection, and immediate account sign-in.
Unit tests: 18/18. Typecheck and production build: clean.
