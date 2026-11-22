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
- **Email confirmation: ON (link-based)** - new admin accounts must open the
  confirmation link emailed to them before they can sign in. After the first
  confirmed sign-in, their admin join request is created automatically and an
  existing admin approves it. A verified email is never an admin grant by
  itself - approval is by authenticated account (UID).
- **Confirm password** is required at signup (live mismatch check plus
  server-side validation).
- **Forgot / reset password** - the Forgot password form on Admin Login emails
  a reset link; the link opens the Set a New Admin Password page
  (`/admin/reset-password`), which saves the new password and ends the
  temporary recovery session.
- **Custom SMTP sender: CONFIGURED (Brevo free plan)** - auth emails send
  through Brevo's SMTP relay (smtp-relay.brevo.com, port 587) with display
  name "rankrush", to any recipient. New custom senders start at 30
  messages/hour (adjustable under Authentication > Rate Limits). Because the
  sender address is a free Gmail address that cannot be domain-authenticated,
  Brevo rewrites the From ADDRESS to its own domain
  (...@....brevosend.com) on outgoing mail. The display name is configured
  as "rankrush" in both Supabase (sender name) and Brevo (sender), and a
  delivered test email confirmed the sender displays as "rankrush" in the
  recipient's mail app. Deliverability caveat: that test email landed in
  the recipient's JUNK folder, so inbox placement is not guaranteed with
  an unauthenticated free Gmail sender (marking it "not junk" once trains
  that mailbox). Adding and authenticating your own domain in Brevo later
  removes the rewrite and improves deliverability.
- **SMTP key maintenance (important between events)** - the Brevo SMTP key has
  no fixed expiry date, but Brevo deactivates ANY key that sends no
  successful email for 90 days, even with "no expiration" set. Brevo emails a
  reminder to the account address 7 days before and on the day. If the app
  sleeps between events: reactivate the key in Brevo (Settings > SMTP & API),
  or generate a new key there and paste it into Authentication > SMTP
  Settings > Password, then Save. Source:
  https://help.brevo.com/hc/en-us/articles/7959631848850-Create-and-manage-your-SMTP-keys
- **Brevo account** - registered on the project owner's Gmail (login saved in
  the Instinct vault). The free plan (300 emails/day) covers this app's
  volume; no paid upgrade is needed.
- **Site URL / redirects** - currently set for local development
  (http://localhost:3000, with /admin/login and /admin/reset-password on the
  redirect allow list, plus the :4173 preview port). After you deploy, set
  Authentication > URL Configuration > Site URL to your deployed app URL and
  add https://YOUR-DOMAIN/admin/login and /admin/reset-password to the
  Redirect URLs allow list, or email links will not open the app.

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
Unit tests: 19/19. Typecheck and production build: clean.
