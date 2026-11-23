-- ============================================================================
-- Migration 10: shared round clock.
-- One shared clock per round: judges pick a team while selection is open,
-- the admin starts a 10-minute presentation countdown, then a shared 1-minute
-- rating window opens in which each judge can score ONLY their picked team.
-- All window math uses the database clock (now()); browsers only display it.
-- Idempotent: safe to re-run.
-- ============================================================================
begin;

create table if not exists public.round_state (
  id boolean primary key default true check (id),
  round_number int not null default 0 check (round_number >= 0),
  status text not null default 'idle' check (status in ('idle','selecting','live')),
  present_seconds int not null default 600 check (present_seconds between 10 and 7200),
  rate_seconds int not null default 60 check (rate_seconds between 10 and 3600),
  present_ends_at timestamptz,
  rate_ends_at timestamptz,
  updated_at timestamptz not null default now()
);
insert into public.round_state (id) values (true) on conflict (id) do nothing;

create table if not exists public.judge_team_selections (
  round_number int not null,
  judge_id text not null references public.judges(id) on delete cascade,
  judge_uid uuid not null references auth.users(id) on delete cascade,
  team_id text not null references public.teams(id) on delete cascade,
  selected_at timestamptz not null default now(),
  primary key (round_number, judge_id)
);

alter table public.round_state enable row level security;
alter table public.judge_team_selections enable row level security;

-- Round state is world-readable (judges + projector render the shared clock);
-- writes go through the admin RPCs below.
drop policy if exists round_state_select on public.round_state;
create policy round_state_select on public.round_state for select using (true);

-- Judges read only their own pick; picks are written via select_team_for_round.
drop policy if exists selections_self_select on public.judge_team_selections;
create policy selections_self_select on public.judge_team_selections
  for select using (judge_uid = auth.uid());
drop policy if exists selections_admin_all on public.judge_team_selections;
create policy selections_admin_all on public.judge_team_selections
  for all using (public.is_admin()) with check (public.is_admin());

-- True while a NEW score for this judge+team is inside the current round's
-- rating window: shared clock past the presentation end, before the rating
-- deadline (+10s server grace for tap-to-save latency), and the judge picked
-- this team for this round. Used by both submit_score and the evaluations
-- insert policy so the RPC and direct writes can never disagree.
create or replace function public.rating_window_open(p_judge_id text, p_team_id text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from round_state r
    join judge_team_selections s
      on s.round_number = r.round_number
     and s.judge_id = p_judge_id
     and s.team_id = p_team_id
    where r.id
      and r.status = 'live'
      and r.present_ends_at is not null
      and r.rate_ends_at is not null
      and now() >= r.present_ends_at
      and now() <= r.rate_ends_at + interval '10 seconds'
  );
$$;

-- Judge picks (or changes) their team for the current round. Only while the
-- admin has selection open; locked once the clock starts.
create or replace function public.select_team_for_round(p_judge_id text, p_team_id text)
returns public.judge_team_selections
language plpgsql security definer set search_path = public as $$
declare
  v_round public.round_state;
  v_sel public.judge_team_selections;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from judges where id = p_judge_id and uid = auth.uid() and active) then
    raise exception 'judge not active';
  end if;
  select * into v_round from round_state where id;
  if v_round.status <> 'selecting' then
    raise exception 'team selection is not open';
  end if;
  if not exists (select 1 from teams where id = p_team_id) then
    raise exception 'team not found';
  end if;
  insert into judge_team_selections (round_number, judge_id, judge_uid, team_id)
  values (v_round.round_number, p_judge_id, auth.uid(), p_team_id)
  on conflict (round_number, judge_id) do update
    set team_id = excluded.team_id,
        judge_uid = excluded.judge_uid,
        selected_at = now()
  returning * into v_sel;
  return v_sel;
end $$;

-- Admin: open team selection for the next round. Refuses to cut over while a
-- clock is still running. Teams left 'Presenting' by the previous round are
-- marked 'Completed'.
create or replace function public.start_round_selection()
returns public.round_state
language plpgsql security definer set search_path = public as $$
declare
  v_round public.round_state;
begin
  if not (select is_admin()) then raise exception 'admin only'; end if;
  select * into v_round from round_state where id for update;
  if v_round.status = 'live'
     and v_round.rate_ends_at is not null
     and now() <= v_round.rate_ends_at + interval '10 seconds' then
    raise exception 'round still running';
  end if;
  update teams set presentation_status = 'Completed', updated_at = now()
  where presentation_status = 'Presenting';
  update round_state set
    round_number = round_number + 1,
    status = 'selecting',
    present_ends_at = null,
    rate_ends_at = null,
    updated_at = now()
  where id
  returning * into v_round;
  return v_round;
end $$;

-- Admin: start the shared clock for the round whose selection is open.
create or replace function public.start_round_clock()
returns public.round_state
language plpgsql security definer set search_path = public as $$
declare
  v_round public.round_state;
begin
  if not (select is_admin()) then raise exception 'admin only'; end if;
  select * into v_round from round_state where id for update;
  if v_round.status <> 'selecting' then
    raise exception 'open team selection first';
  end if;
  update round_state set
    status = 'live',
    present_ends_at = now() + make_interval(secs => v_round.present_seconds),
    rate_ends_at = now() + make_interval(secs => v_round.present_seconds + v_round.rate_seconds),
    updated_at = now()
  where id
  returning * into v_round;
  update teams set presentation_status = 'Presenting', updated_at = now()
  where id in (
    select team_id from judge_team_selections
    where round_number = v_round.round_number
  );
  return v_round;
end $$;

-- Admin: add seconds to the running clock. While presenting, both deadlines
-- move; once the rating window is open, only the rating deadline moves.
create or replace function public.extend_round_clock(p_seconds int)
returns public.round_state
language plpgsql security definer set search_path = public as $$
declare
  v_round public.round_state;
begin
  if not (select is_admin()) then raise exception 'admin only'; end if;
  if p_seconds is null or p_seconds < 10 or p_seconds > 3600 then
    raise exception 'extension must be 10-3600 seconds';
  end if;
  select * into v_round from round_state where id for update;
  if v_round.status <> 'live' or v_round.rate_ends_at is null then
    raise exception 'no running round';
  end if;
  if now() > v_round.rate_ends_at + interval '10 seconds' then
    raise exception 'round already closed';
  end if;
  if now() < v_round.present_ends_at then
    update round_state set
      present_ends_at = present_ends_at + make_interval(secs => p_seconds),
      rate_ends_at = rate_ends_at + make_interval(secs => p_seconds),
      updated_at = now()
    where id
    returning * into v_round;
  else
    update round_state set
      rate_ends_at = rate_ends_at + make_interval(secs => p_seconds),
      updated_at = now()
    where id
    returning * into v_round;
  end if;
  return v_round;
end $$;

-- Admin: reopen the 1-minute rating window for the CURRENT round after it
-- closed (event over-runs). The picks made during selection still stand.
create or replace function public.reopen_rating_window()
returns public.round_state
language plpgsql security definer set search_path = public as $$
declare
  v_round public.round_state;
begin
  if not (select is_admin()) then raise exception 'admin only'; end if;
  select * into v_round from round_state where id for update;
  if v_round.round_number = 0 then raise exception 'no round yet'; end if;
  if v_round.status = 'live'
     and v_round.rate_ends_at is not null
     and now() <= v_round.rate_ends_at + interval '10 seconds' then
    raise exception 'rating window still open';
  end if;
  update round_state set
    status = 'live',
    present_ends_at = now(),
    rate_ends_at = now() + make_interval(secs => v_round.rate_seconds),
    updated_at = now()
  where id
  returning * into v_round;
  return v_round;
end $$;

-- Admin: end the current round without opening the next one.
create or replace function public.end_round()
returns public.round_state
language plpgsql security definer set search_path = public as $$
declare
  v_round public.round_state;
begin
  if not (select is_admin()) then raise exception 'admin only'; end if;
  update teams set presentation_status = 'Completed', updated_at = now()
  where presentation_status = 'Presenting';
  update round_state set
    status = 'idle',
    present_ends_at = null,
    rate_ends_at = null,
    updated_at = now()
  where id
  returning * into v_round;
  return v_round;
end $$;

-- submit_score: NEW scores now also require the shared rating window and the
-- judge's own pick for the round. Edits keep following editing_allowed.
create or replace function public.submit_score(
  p_judge_id text, p_team_id text, p_criteria jsonb, p_comment text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_eval_id text := p_judge_id || '_' || p_team_id;
  v_total int;
  v_round public.round_state;
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
    select * into v_round from round_state where id;
    if v_round.status <> 'live'
       or v_round.present_ends_at is null
       or now() < v_round.present_ends_at then
      raise exception 'rating window not open';
    end if;
    if now() > v_round.rate_ends_at + interval '10 seconds' then
      raise exception 'rating window closed';
    end if;
    if not exists (
      select 1 from judge_team_selections
      where round_number = v_round.round_number
        and judge_id = p_judge_id
        and team_id = p_team_id
    ) then
      raise exception 'team not selected this round';
    end if;
    insert into evaluations (id, judge_id, judge_uid, team_id, score_version, criteria, total, comment)
    values (v_eval_id, p_judge_id, auth.uid(), p_team_id, 2, p_criteria, v_total, left(coalesce(p_comment,''),1000));
    update teams set submitted_count = submitted_count + 1, updated_at = now() where id = p_team_id;
  end if;
end $$;

-- Direct-write parity: the insert policy checks the same window + pick.
drop policy if exists evaluations_self_insert on public.evaluations;
create policy evaluations_self_insert on public.evaluations for insert with check (
  judge_uid = auth.uid()
  and public.submissions_open()
  and public.rating_window_open(judge_id, team_id)
  and exists (select 1 from public.judges j where j.id = judge_id and j.uid = auth.uid() and j.active)
);

-- Reset the round clock with the rest of the event.
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
  delete from judge_team_selections where true;
  update round_state set
    round_number = 0, status = 'idle',
    present_ends_at = null, rate_ends_at = null, updated_at = now()
  where id;
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

grant select on public.round_state to anon, authenticated;
grant select on public.judge_team_selections to anon, authenticated;
grant execute on function public.rating_window_open(text, text) to anon, authenticated;
grant execute on function public.select_team_for_round(text, text) to anon, authenticated;
grant execute on function public.start_round_selection() to authenticated;
grant execute on function public.start_round_clock() to authenticated;
grant execute on function public.extend_round_clock(int) to authenticated;
grant execute on function public.reopen_rating_window() to authenticated;
grant execute on function public.end_round() to authenticated;

do $pub$ begin
  alter publication supabase_realtime add table public.round_state;
exception when duplicate_object then null;
end $pub$;
do $pub$ begin
  alter publication supabase_realtime add table public.judge_team_selections;
exception when duplicate_object then null;
end $pub$;

commit;
