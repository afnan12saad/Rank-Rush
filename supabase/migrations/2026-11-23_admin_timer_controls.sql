-- Admin timer editing. No table data is changed by this migration.
begin;
alter table public.round_state add column if not exists round_name text not null default '' check (char_length(round_name) <= 80);
create or replace function public.name_round(p_round_number int, p_name text)
returns public.round_state language plpgsql security definer set search_path = public as $$
declare v_round public.round_state;
begin
 if not (select is_admin()) then raise exception 'admin only'; end if;
 if p_name is null or char_length(trim(p_name)) > 80 then raise exception 'Round name must be at most 80 characters.'; end if;
 select * into v_round from round_state where id for update;
 if v_round.round_number = 0 or p_round_number is distinct from v_round.round_number then raise exception 'Round changed. Open a round first.'; end if;
 update round_state set round_name = trim(p_name), updated_at = now() where id returning * into v_round;
 return v_round;
end $$;
-- Clear the label only when the round number changes (also covers event reset).
create or replace function public.clear_next_round_name() returns trigger language plpgsql set search_path = public as $$
begin if new.round_number is distinct from old.round_number then new.round_name := ''; end if; return new; end $$;
drop trigger if exists clear_next_round_name on public.round_state;
create trigger clear_next_round_name before update on public.round_state for each row execute function public.clear_next_round_name();
revoke all on function public.name_round(int,text) from public, anon;
grant execute on function public.name_round(int,text) to authenticated;


create or replace function public.configure_round_clock(p_present_seconds int, p_rate_seconds int)
returns public.round_state
language plpgsql security definer set search_path = public as $$
declare v_round public.round_state;
begin
  if not (select is_admin()) then raise exception 'admin only'; end if;
  if p_present_seconds is null or p_present_seconds not between 10 and 7200
     or p_rate_seconds is null or p_rate_seconds not between 10 and 3600 then
    raise exception 'Presentation must be 10-7200 seconds; rating must be 10-3600 seconds.';
  end if;
  update round_state set present_seconds = p_present_seconds,
    rate_seconds = p_rate_seconds, updated_at = now()
  where id returning * into v_round;
  return v_round;
end $$;

-- Phase and round checks prevent a stale tab from changing a different timer.
create or replace function public.edit_round_time_left(p_round_number int, p_phase text, p_seconds int)
returns public.round_state
language plpgsql security definer set search_path = public as $$
declare v_round public.round_state;
begin
  if not (select is_admin()) then raise exception 'admin only'; end if;
  if p_phase is null or p_phase not in ('presenting', 'rating') then
    raise exception 'Invalid timer phase.';
  end if;
  if p_seconds is null or p_seconds < 10
     or p_seconds > (case when p_phase = 'presenting' then 7200 else 3600 end) then
    raise exception 'Time left is outside the allowed range.';
  end if;
  select * into v_round from round_state where id for update;
  if p_round_number is distinct from v_round.round_number or v_round.status <> 'live'
     or v_round.present_ends_at is null or v_round.rate_ends_at is null then
    raise exception 'Round changed. Refresh and try again.';
  end if;
  if p_phase = 'presenting' and now() < v_round.present_ends_at then
    update round_state set
      present_ends_at = now() + make_interval(secs => p_seconds),
      rate_ends_at = now() + make_interval(secs => p_seconds)
        + (v_round.rate_ends_at - v_round.present_ends_at),
      updated_at = now()
    where id returning * into v_round;
  elsif p_phase = 'rating' and now() >= v_round.present_ends_at and now() <= v_round.rate_ends_at then
    update round_state set rate_ends_at = now() + make_interval(secs => p_seconds), updated_at = now()
    where id returning * into v_round;
  else
    raise exception 'Timer phase changed. Refresh and try again.';
  end if;
  return v_round;
end $$;

create or replace function public.end_round_presentation(p_round_number int)
returns public.round_state
language plpgsql security definer set search_path = public as $$
declare v_round public.round_state;
begin
  if not (select is_admin()) then raise exception 'admin only'; end if;
  select * into v_round from round_state where id for update;
  if p_round_number is distinct from v_round.round_number or v_round.status <> 'live'
     or v_round.present_ends_at is null or now() >= v_round.present_ends_at then
    raise exception 'Presentation is no longer running. Refresh and try again.';
  end if;
  update round_state set present_ends_at = now(),
    rate_ends_at = now() + make_interval(secs => v_round.rate_seconds), updated_at = now()
  where id returning * into v_round;
  return v_round;
end $$;

revoke all on function public.configure_round_clock(int,int) from public, anon;
revoke all on function public.edit_round_time_left(int,text,int) from public, anon;
revoke all on function public.end_round_presentation(int) from public, anon;
grant execute on function public.configure_round_clock(int,int) to authenticated;
grant execute on function public.edit_round_time_left(int,text,int) to authenticated;
grant execute on function public.end_round_presentation(int) to authenticated;
commit;
