-- Applied live Nov 23, 2026. Judges select any team and rate without the round clock.
-- Restores the pre-timer submit_score and evaluations_self_insert policy.

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

drop policy if exists evaluations_self_insert on public.evaluations;
create policy evaluations_self_insert on public.evaluations for insert with check (
  judge_uid = auth.uid()
  and public.submissions_open()
  and exists (select 1 from public.judges j where j.id = judge_id and j.uid = auth.uid() and j.active)
);
