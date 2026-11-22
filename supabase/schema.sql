-- Rank Rush (Supabase) - draft schema + RLS. Not yet applied.
-- Mirrors the Firestore data model and security rules of LEADERBOARD-CALCULATOR.
-- Five-criteria scores are enforced by CHECK constraints (real backend enforcement).

-- ============ TABLES ============

create table if not exists public.admins (
  uid uuid primary key references auth.users(id) on delete cascade,
  email text not null check (char_length(email) between 3 and 160),
  name text not null check (char_length(name) between 1 and 100),
  is_first_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_requests (
  uid uuid primary key references auth.users(id) on delete cascade,
  email text not null check (char_length(email) between 3 and 160),
  name text not null check (char_length(name) between 1 and 100),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  verification_code text not null default '',
  first_admin_email text not null default '',
  first_admin_uid uuid,
  requested_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by text
);

-- single-row table
create table if not exists public.admin_quota (
  id boolean primary key default true check (id),
  count int not null default 0 check (count >= 0),
  max_admins int not null default 5 check (max_admins >= 1),
  first_admin_email text,
  first_admin_uid uuid,
  updated_at timestamptz not null default now()
);

insert into public.admin_quota (id) values (true) on conflict (id) do nothing;

create table if not exists public.settings_event (
  id boolean primary key default true check (id),
  event_name text not null default 'Rank Rush' check (char_length(event_name) between 1 and 120),
  college_name text not null default '' check (char_length(college_name) <= 140),
  tagline text not null default '' check (char_length(tagline) <= 120),
  venue text not null default '' check (char_length(venue) <= 140),
  event_date text not null default '' check (char_length(event_date) <= 60),
  custom_domain text not null default '' check (char_length(custom_domain) <= 200),
  submissions_open boolean not null default true,
  editing_allowed boolean not null default false,
  results_published boolean not null default false,
  tie_breaker_mode text not null default 'tie' check (tie_breaker_mode in ('tie','admin_order')),
  current_team_id text not null default '' check (char_length(current_team_id) <= 128),
  timer_duration_seconds int not null default 0 check (timer_duration_seconds between 0 and 86400),
  timer_warning_seconds int not null default 0 check (timer_warning_seconds between 0 and 43200),
  timer_remaining_seconds int not null default 0 check (timer_remaining_seconds between 0 and 86400),
  timer_running boolean not null default false,
  timer_started_at_ms bigint not null default 0 check (timer_started_at_ms >= 0),
  updated_at timestamptz not null default now()
);

-- single-row seeds: fresh projects must start with these rows, otherwise quota
-- enforcement and event settings reads silently no-op. (Found by live tests.)
insert into public.settings_event (id) values (true) on conflict (id) do nothing;

create table if not exists public.public_summary (
  id boolean primary key default true check (id),
  total_judges int not null default 0 check (total_judges between 0 and 1000),
  updated_at timestamptz not null default now()
);

create table if not exists public.teams (
  id text primary key check (id ~ '^[a-zA-Z0-9_\-]{1,128}$'),
  name text not null check (char_length(name) between 1 and 100),
  project_title text not null default '' check (char_length(project_title) <= 160),
  description text not null default '' check (char_length(description) <= 500),
  logo_url text not null default '' check (char_length(logo_url) <= 200000),
  presentation_status text not null default 'Waiting' check (presentation_status in ('Waiting','Presenting','Completed')),
  order_index int not null default 0 check (order_index between 0 and 1000),
  tie_breaker_rank int not null default 0 check (tie_breaker_rank between 0 and 1000),
  submitted_count int not null default 0 check (submitted_count between 0 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.judges (
  id text primary key check (id ~ '^[a-zA-Z0-9_\-]{1,128}$'),
  judge_code text not null check (judge_code ~ '^[A-Z0-9_\-]{2,32}$'),
  name text not null check (char_length(name) between 1 and 100),
  department text not null default '' check (char_length(department) <= 100),
  email text not null default '' check (char_length(email) <= 160),
  uid uuid not null references auth.users(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists judges_uid_key on public.judges (uid);

-- Five-criteria evaluation. criteria jsonb: {"c1":0..5,...,"c5":0..5}; total = exact sum.
create table if not exists public.evaluations (
  id text primary key check (char_length(id) between 3 and 256),
  judge_id text not null references public.judges(id) on delete cascade,
  judge_uid uuid not null references auth.users(id) on delete cascade,
  team_id text not null references public.teams(id) on delete cascade,
  score_version int not null default 2 check (score_version = 2),
  criteria jsonb not null,
  total int not null check (total between 0 and 25),
  comment text not null default '' check (char_length(comment) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (id = judge_id || '_' || team_id),
  check (
    criteria ?& array['c1','c2','c3','c4','c5']
    and criteria - 'c1' - 'c2' - 'c3' - 'c4' - 'c5' = '{}'::jsonb
    and (criteria->>'c1') ~ '^[0-5]$' and (criteria->>'c2') ~ '^[0-5]$'
    and (criteria->>'c3') ~ '^[0-5]$' and (criteria->>'c4') ~ '^[0-5]$'
    and (criteria->>'c5') ~ '^[0-5]$'
    and total = (criteria->>'c1')::int + (criteria->>'c2')::int + (criteria->>'c3')::int
              + (criteria->>'c4')::int + (criteria->>'c5')::int
  )
);

create table if not exists public.public_leaderboard (
  id boolean primary key default true check (id),
  published boolean not null default false,
  total_judges int not null default 0 check (total_judges between 0 and 1000),
  total_teams int not null default 0 check (total_teams between 0 and 200),
  total_submissions int not null default 0 check (total_submissions >= 0),
  entries jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- ============ HELPERS ============

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.admins where uid = auth.uid()) $$;

create or replace function public.is_active_judge() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.judges where uid = auth.uid() and active) $$;

create or replace function public.submissions_open() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce((select submissions_open from public.settings_event where id), false) $$;

create or replace function public.editing_allowed() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce((select editing_allowed from public.settings_event where id), false) $$;

create or replace function public.results_published() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce((select results_published from public.settings_event where id), false) $$;

-- ============ RLS ============

alter table public.admins enable row level security;
alter table public.admin_requests enable row level security;
alter table public.admin_quota enable row level security;
alter table public.settings_event enable row level security;
alter table public.public_summary enable row level security;
alter table public.teams enable row level security;
alter table public.judges enable row level security;
alter table public.evaluations enable row level security;
alter table public.public_leaderboard enable row level security;

-- admins: admin reads all; self reads own. Writes only via RPC (security definer).
create policy admins_select on public.admins for select using (public.is_admin() or uid = auth.uid());

-- admin_requests: admin all; requester reads/creates own pending request.
create policy admin_requests_admin on public.admin_requests for all using (public.is_admin()) with check (public.is_admin());
create policy admin_requests_self_select on public.admin_requests for select using (uid = auth.uid());
create policy admin_requests_self_insert on public.admin_requests for insert with check (uid = auth.uid() and status = 'pending');

-- admin_quota: world-readable count (no PII beyond first-admin email... keep admin-only read to be safe? Firestore allowed public get of adminQuota.)
create policy admin_quota_select on public.admin_quota for select using (true);

-- settings: world-readable single doc; admin writes.
create policy settings_select on public.settings_event for select using (true);
create policy settings_admin_write on public.settings_event for all using (public.is_admin()) with check (public.is_admin());

-- public summary: world-readable; admin writes.
create policy summary_select on public.public_summary for select using (true);
create policy summary_admin_write on public.public_summary for all using (public.is_admin()) with check (public.is_admin());

-- teams: world-readable; admin writes (submitted_count increments go through RPC).
create policy teams_select on public.teams for select using (true);
create policy teams_admin_write on public.teams for all using (public.is_admin()) with check (public.is_admin());

-- judges: admin reads all; judge reads own row; self-registration insert with own uid; admin update/delete.
create policy judges_admin_all on public.judges for all using (public.is_admin()) with check (public.is_admin());
create policy judges_self_select on public.judges for select using (uid = auth.uid());
create policy judges_self_insert on public.judges for insert with check (uid = auth.uid() and active = true and char_length(email) >= 3);
create policy judges_self_update on public.judges for update using (uid = auth.uid() and active = true) with check (uid = auth.uid() and active = true);

-- evaluations: admin all; judge inserts/updates own while submissions open; judge reads own.
create policy evaluations_admin_all on public.evaluations for all using (public.is_admin()) with check (public.is_admin());
create policy evaluations_self_select on public.evaluations for select using (judge_uid = auth.uid());
create policy evaluations_self_insert on public.evaluations for insert with check (
  judge_uid = auth.uid()
  and public.submissions_open()
  and exists (select 1 from public.judges j where j.id = judge_id and j.uid = auth.uid() and j.active)
);
create policy evaluations_self_update on public.evaluations for update using (
  judge_uid = auth.uid()
  and public.submissions_open()
  and public.editing_allowed()
  and exists (select 1 from public.judges j where j.id = evaluations.judge_id and j.uid = auth.uid() and j.active)
) with check (
  judge_uid = auth.uid() and judge_id = evaluations.judge_id and team_id = evaluations.team_id
);

-- public leaderboard: admin always; everyone once the row itself is published.
create policy leaderboard_admin_all on public.public_leaderboard for all using (public.is_admin()) with check (public.is_admin());
create policy leaderboard_public_read on public.public_leaderboard for select using (published = true);

-- ============ RPCs (atomic multi-row operations) ============

-- Submit or edit a five-criteria score; increments team.submitted_count on first submit.
create or replace function public.submit_score(
  p_judge_id text, p_team_id text, p_criteria jsonb, p_comment text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_eval_id text := p_judge_id || '_' || p_team_id;
  v_total int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not (select submissions_open()) then raise exception 'submissions closed'; end if;
  if not exists (select 1 from judges where id = p_judge_id and uid = auth.uid() and active) then
    raise exception 'judge not active';
  end if;
  v_total := (p_criteria->>'c1')::int + (p_criteria->>'c2')::int + (p_criteria->>'c3')::int
           + (p_criteria->>'c4')::int + (p_criteria->>'c5')::int;
  if exists (select 1 from evaluations where id = v_eval_id) then
    if not (select editing_allowed()) then raise exception 'editing locked'; end if;
    update evaluations set criteria = p_criteria, total = v_total,
      comment = left(coalesce(p_comment,''), 1000), updated_at = now()
    where id = v_eval_id and judge_uid = auth.uid();
  else
    insert into evaluations (id, judge_id, judge_uid, team_id, score_version, criteria, total, comment)
    values (v_eval_id, p_judge_id, auth.uid(), p_team_id, 2, p_criteria, v_total, left(coalesce(p_comment,''),1000));
    update teams set submitted_count = submitted_count + 1, updated_at = now() where id = p_team_id;
  end if;
end $$;

-- Approve an admin join request with a hard cap enforced in one transaction.
create or replace function public.approve_admin_request(p_uid uuid, p_approved_by text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_req public.admin_requests;
  v_count int;
  v_max int;
begin
  if not (select is_admin()) then raise exception 'admin only'; end if;
  select * into v_req from admin_requests where uid = p_uid and status = 'pending' for update;
  if not found then raise exception 'no pending request'; end if;
  select count, max_admins into v_count, v_max from admin_quota where id for update;
  if v_count >= v_max then raise exception 'admin limit of % reached', v_max; end if;
  insert into admins (uid, email, name, is_first_admin) values (v_req.uid, v_req.email, v_req.name, false);
  update admin_requests set status = 'approved', approved_at = now(), approved_by = left(p_approved_by,160), updated_at = now() where uid = p_uid;
  update admin_quota set count = count + 1, updated_at = now() where id;
end $$;

-- Archived standings of finished events (admin-only). Unlike the Firestore
-- deployment, this backend CAN keep the archive safety model.
create table if not exists public.event_archives (
  id text primary key,
  event_name text not null check (char_length(event_name) <= 160),
  archived_at timestamptz not null default now(),
  archived_by text not null default '' check (char_length(archived_by) <= 160),
  total_judges int not null default 0,
  total_teams int not null default 0,
  total_submissions int not null default 0,
  entries jsonb not null default '[]'::jsonb,
  score_max int not null default 25
);
alter table public.event_archives enable row level security;
create policy archives_admin on public.event_archives for all using (public.is_admin()) with check (public.is_admin());

-- Archive current standings then reset for a new event, atomically.
-- Advisory lock makes concurrent admin resets fail fast instead of interleaving.
create or replace function public.archive_and_reset_event(
  p_event_name text, p_archived_by text, p_entries jsonb,
  p_total_judges int, p_total_teams int, p_total_submissions int,
  p_expected_evals int, p_default_teams jsonb, p_settings jsonb
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_archive_id text := 'ev_' || extract(epoch from now())::bigint;
  v_actual int;
begin
  if not (select is_admin()) then raise exception 'admin only'; end if;
  if not pg_try_advisory_xact_lock(727274) then
    raise exception 'another reset is already running';
  end if;
  -- Close submissions first so no score can arrive mid-reset.
  update settings_event set submissions_open = false, updated_at = now() where id;
  select count(*) into v_actual from evaluations;
  if v_actual <> p_expected_evals then
    raise exception 'ratings changed; archive not saved, nothing reset';
  end if;
  insert into event_archives (id, event_name, archived_by, total_judges, total_teams, total_submissions, entries)
  values (v_archive_id, left(p_event_name,160), left(p_archived_by,160), p_total_judges, p_total_teams, p_total_submissions, coalesce(p_entries,'[]'::jsonb));
  delete from evaluations where true;
  delete from judges where true;
  delete from teams where true;
  insert into teams (id, name, project_title, description, logo_url, presentation_status, order_index, tie_breaker_rank, submitted_count)
  select t->>'id', t->>'name', t->>'projectTitle', t->>'description', '', 'Waiting',
         coalesce((t->>'orderIndex')::int, ord), coalesce((t->>'tieBreakerRank')::int, ord), 0
  from jsonb_array_elements(p_default_teams) with ordinality as t(t, ord);
  update settings_event set
    results_published = false, submissions_open = true,
    current_team_id = '',
    timer_duration_seconds = coalesce((p_settings->>'timerDurationSeconds')::int, timer_duration_seconds),
    timer_remaining_seconds = coalesce((p_settings->>'timerDurationSeconds')::int, timer_remaining_seconds),
    timer_running = false, timer_started_at_ms = 0, updated_at = now()
  where id;
  insert into public_summary (id, total_judges) values (true, 0)
  on conflict (id) do update set total_judges = 0, updated_at = now();
  insert into public_leaderboard (id, published, total_judges, total_teams, total_submissions, entries)
  values (true, false, 0, (select count(*) from teams), 0, '[]'::jsonb)
  on conflict (id) do update set published = false, total_judges = 0,
    total_teams = (select count(*) from teams), total_submissions = 0, entries = '[]'::jsonb, updated_at = now();
  return v_archive_id;
end $$;

-- Publish or hide results atomically (settings flag + leaderboard snapshot).
create or replace function public.publish_results(
  p_publish boolean, p_total_judges int, p_total_teams int, p_total_submissions int, p_entries jsonb
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (select is_admin()) then raise exception 'admin only'; end if;
  update settings_event set results_published = p_publish, updated_at = now() where id;
  insert into public_leaderboard (id, published, total_judges, total_teams, total_submissions, entries, updated_at)
  values (true, p_publish, p_total_judges, p_total_teams, p_total_submissions, coalesce(p_entries,'[]'::jsonb), now())
  on conflict (id) do update set published = excluded.published, total_judges = excluded.total_judges,
    total_teams = excluded.total_teams, total_submissions = excluded.total_submissions,
    entries = excluded.entries, updated_at = excluded.updated_at;
end $$;

-- Explicit Data API grants (auto-grant was left off at project creation).
grant usage on schema public to anon, authenticated;
grant select on public.settings_event, public.public_summary, public.public_leaderboard, public.teams, public.admin_quota to anon, authenticated;
grant select on public.evaluations, public.judges, public.admin_requests, public.admins, public.event_archives to authenticated;

-- Admin DML via the Data API (RLS policies above still gate every row to is_admin()).
grant update on public.admin_requests to authenticated;
grant insert, update, delete on public.teams to authenticated;
grant delete on public.judges to authenticated;
grant delete on public.evaluations to authenticated;
grant insert, update on public.evaluations to authenticated;
grant update on public.public_summary to authenticated;
grant update on public.settings_event to authenticated;
grant insert on public.event_archives to authenticated;
grant insert on public.judges to anon, authenticated;
grant insert on public.admin_requests to authenticated;
grant update on public.judges to anon, authenticated;
grant execute on function public.submit_score(text, text, jsonb, text) to anon, authenticated;
grant execute on function public.publish_results(boolean, int, int, int, jsonb) to authenticated;
grant execute on function public.approve_admin_request(uuid, text) to authenticated;
grant execute on function public.archive_and_reset_event(text, text, jsonb, int, int, int, int, jsonb, jsonb) to authenticated;

-- ============================================================================
-- Migration 2 (applied): register_judge + remove_admin RPCs.
-- Migration 3 (applied): judges.uid nullable; register_judge binds a
-- pre-added (uid NULL) judge row by email before creating a new one.
-- ============================================================================

alter table public.judges alter column uid drop not null;

create or replace function public.register_judge(p_name text, p_email text)
returns public.judges
language plpgsql security definer set search_path = public as $$
declare
  v_id text := 'J' || upper(substr(replace(auth.uid()::text, '-', ''), 1, 11));
  v_judge public.judges;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if char_length(trim(p_name)) < 2 or char_length(p_name) > 100 then
    raise exception 'invalid name';
  end if;
  if char_length(p_email) < 3 or char_length(p_email) > 160 then
    raise exception 'invalid email';
  end if;
  select * into v_judge from judges where uid = auth.uid();
  if found then
    if not v_judge.active then
      raise exception 'Your judge access has been deactivated by an administrator.';
    end if;
    update judges set name = left(trim(p_name),100), email = lower(trim(p_email)), updated_at = now()
    where uid = auth.uid()
    returning * into v_judge;
    return v_judge;
  end if;
  -- Bind an admin pre-added row (same email, no account linked yet).
  select * into v_judge from judges
  where uid is null and lower(email) = lower(trim(p_email))
  limit 1;
  if found then
    if not v_judge.active then
      raise exception 'Your judge access has been deactivated by an administrator.';
    end if;
    update judges set uid = auth.uid(), name = left(trim(p_name),100), updated_at = now()
    where id = v_judge.id
    returning * into v_judge;
    return v_judge;
  end if;
  insert into judges (id, judge_code, name, department, email, uid, active)
  values (v_id, v_id, left(trim(p_name),100), '', lower(trim(p_email)), auth.uid(), true)
  returning * into v_judge;
  insert into public_summary (id, total_judges) values (true, 1)
  on conflict (id) do update set total_judges = public_summary.total_judges + 1, updated_at = now();
  return v_judge;
end $$;

create or replace function public.remove_admin(p_uid uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (select is_admin()) then raise exception 'admin only'; end if;
  if p_uid = auth.uid() then raise exception 'cannot remove yourself'; end if;
  if exists (select 1 from admins where uid = p_uid and is_first_admin) then
    raise exception 'cannot remove the first admin';
  end if;
  delete from admins where uid = p_uid;
  if found then
    update admin_quota set count = greatest(count - 1, 0), updated_at = now() where id;
    -- Free the join-request slot so a removed admin can request access again
    -- later (admin_requests.uid is the primary key; a leftover 'approved' row
    -- blocked any fresh request with a duplicate-key error).
    delete from admin_requests where uid = p_uid;
  end if;
end $$;

grant execute on function public.register_judge(text, text) to anon, authenticated;
grant execute on function public.remove_admin(uuid) to authenticated;

-- Migration 3b: realtime for live subscriptions (new tables are not in the
-- default publication; without this the app's live updates never fire).
alter publication supabase_realtime add table public.settings_event;
alter publication supabase_realtime add table public.public_summary;
alter publication supabase_realtime add table public.admin_quota;
alter publication supabase_realtime add table public.admins;
alter publication supabase_realtime add table public.admin_requests;
alter publication supabase_realtime add table public.teams;
alter publication supabase_realtime add table public.judges;
alter publication supabase_realtime add table public.evaluations;
alter publication supabase_realtime add table public.public_leaderboard;
alter publication supabase_realtime add table public.event_archives;

-- Migration 4 (applied): pg_safeupdate (API role) blocks WHERE-less DELETEs inside
-- archive_and_reset_event; rewritten as delete ... where true (same semantics).

-- Migration 5 (applied): archive_and_reset_event reseed now falls back to array
-- ordinality when orderIndex/tieBreakerRank are absent (NOT NULL was violated).

-- Migration 6 (applied): archive_and_reset_event now restores timer_duration_seconds
-- too (previously remaining was restored but duration stayed 0, so the timer UI
-- showed "Event Timer (00:00:00)" over nonzero digits).

-- Migration 7 (applied): added the admin DML table grants above (settings_event,
-- public_summary, teams, judges delete, evaluations delete, admin_requests update,
-- event_archives insert). Without them every admin direct write through the Data
-- API failed with "permission denied for table" even though RLS allowed it.

-- Migration 8 (applied): grant insert, update on evaluations to authenticated.
-- The evaluations_self_insert / evaluations_self_update / evaluations_admin_all
-- policies were dead without it: direct table writes failed with "permission
-- denied for table evaluations" before RLS even ran. Score submission in the
-- app goes through the submit_score RPC, so this only enables the direct-write
-- paths the policies already describe (judge writes own row while submissions
-- are open, admin writes any row). Found by live Suite G regression tests.

-- Live-test fixes (Nov 22, 2026): folded back into the table definitions above.
-- 1. admin_requests gained verification_code / first_admin_email /
--    first_admin_uid - the app always inserted these; they had only ever been
--    added to the old project by ad-hoc migration, so a fresh project rejected
--    every join request (PGRST204).
-- 2. Single-row seeds for settings_event and admin_quota are inserted right
--    after their table definitions; without them quota enforcement no-opped.
