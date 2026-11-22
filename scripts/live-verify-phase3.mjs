import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
const URL = 'https://loiwlyqttlwatjimphks.supabase.co';
const ANON = 'sb_publishable_I9wglTINuVt3lmtnX2Jb3Q_AZl8eHFZ';
const uids = JSON.parse(readFileSync('/tmp/rr-uids.json','utf8'));
const teams = JSON.parse(readFileSync('/tmp/rr-default-teams.json','utf8'));
const pw = n => readFileSync('/tmp/rr-'+n+'-pw','utf8').trim();
const em = n => 'rr-'+n+'@rankrush.test';
let pass = 0, fail = 0;
const ok = (name, cond, extra='') => { if (cond) { pass++; console.log('PASS '+name); } else { fail++; console.log('FAIL '+name+' '+extra); } };

const owner = createClient(URL, ANON);
await owner.auth.signInWithPassword({ email: em('owner'), password: pw('owner') });
{
  const { data: admins } = await owner.from('admins').select('uid');
  const { data: q } = await owner.from('admin_quota').select('*').eq('id',true).single();
  ok('H1 quota consistent: count matches rows', q.count === admins.length, JSON.stringify({n:admins.length, q}));
}

// I: seed the event via archive_and_reset with expected 0 evals
{
  const r = await owner.rpc('archive_and_reset_event', { p_event_name:'Rank Rush Test Event', p_archived_by:'Test Owner', p_entries:[], p_total_judges:0, p_total_teams:0, p_total_submissions:0, p_expected_evals:0, p_default_teams: teams, p_settings:{ timerDurationSeconds:300 } });
  ok('I1 initial reset seeds event', !r.error, JSON.stringify(r.error));
  const { data: t } = await owner.from('teams').select('id');
  ok('I2 15 teams seeded', t.length === 15, 'n='+t.length);
  const { data: s } = await owner.from('settings_event').select('*').single();
  ok('I3 settings row: submissions open, results unpublished', s.submissions_open === true && s.results_published === false, JSON.stringify(s));
}

// J: judge lifecycle
const judge = createClient(URL, ANON);
let judgeId;
{
  const { data: s, error: se } = await judge.auth.signInAnonymously();
  ok('J1 anonymous judge sign-in', !se && !!s.session, JSON.stringify(se));
  const { data: j, error: je } = await judge.rpc('register_judge', { p_name: 'Judge One', p_email: 'judge1@rankrush.test' });
  ok('J2 register_judge', !je && j?.id, JSON.stringify(je));
  judgeId = j?.id;
  const r1 = await judge.rpc('submit_score', { p_judge_id: judgeId, p_team_id: 'team-01', p_criteria: {c1:5,c2:4,c3:3,c4:2,c5:1}, p_comment: 'good' });
  ok('J3 valid score accepted', !r1.error, JSON.stringify(r1.error));
  const r2 = await judge.rpc('submit_score', { p_judge_id: judgeId, p_team_id: 'team-02', p_criteria: {c1:9,c2:4,c3:3,c4:2,c5:1}, p_comment: '' });
  ok('J4 out-of-range criterion rejected', !!r2.error, 'no error!');
  const r3 = await judge.rpc('submit_score', { p_judge_id: judgeId, p_team_id: 'team-02', p_criteria: {c1:1,c2:2,c3:3}, p_comment: '' });
  ok('J5 wrong criteria shape rejected', !!r3.error, 'no error!');
  const r4 = await judge.from('evaluations').select('*');
  ok('J6 judge sees only own evaluations', !r4.error && r4.data.length === 1 && r4.data[0].total === 15, JSON.stringify({e:r4.error,n:r4.data?.length}));
  const r5 = await judge.from('public_leaderboard').select('*');
  ok('J7 judge sees no unpublished leaderboard', !r5.error && r5.data.length === 0, 'n='+r5.data?.length);
  const r6 = await judge.from('judges').select('*');
  ok('J8 judge reads only their own judges row', !r6.error && r6.data.length === 1 && r6.data[0].id === judgeId, JSON.stringify({e:r6.error,n:r6.data?.length}));
  // second judge: own-score isolation
  const j2 = createClient(URL, ANON);
  await j2.auth.signInAnonymously();
  const { data: jj2 } = await j2.rpc('register_judge', { p_name: 'Judge Two', p_email: 'judge2@rankrush.test' });
  await j2.rpc('submit_score', { p_judge_id: jj2.id, p_team_id: 'team-01', p_criteria: {c1:1,c2:1,c3:1,c4:1,c5:1}, p_comment: '' });
  const ev2 = await j2.from('evaluations').select('*');
  ok('J9 second judge isolated to own scores', !ev2.error && ev2.data.length === 1 && ev2.data[0].total === 5, 'n='+ev2.data?.length);
}

// K: publish -> audience aggregate visibility
{
  const entries = [
    { teamId:'team-01', teamName:'Team 01', averageScore:10, totalScore:20, rank:1, submissionCount:2 },
    { teamId:'team-02', teamName:'Team 02', averageScore:0, totalScore:0, rank:2, submissionCount:0 },
  ];
  const { error } = await owner.rpc('publish_results', { p_publish: true, p_total_judges: 2, p_total_teams: 15, p_total_submissions: 2, p_entries: entries });
  ok('K1 owner publishes results', !error, JSON.stringify(error));
  const anon = createClient(URL, ANON);
  const r = await anon.from('public_leaderboard').select('*');
  ok('K2 anon audience reads published aggregate', !r.error && r.data.length === 1 && r.data[0].published === true && r.data[0].entries.length === 2, JSON.stringify({e:r.error,n:r.data?.length}));
  const entryStr = JSON.stringify(r.data[0].entries);
  ok('K3 aggregate has no judge identities', !/judge|@rankrush/i.test(entryStr), entryStr.slice(0,120));
  const ev = await anon.from('evaluations').select('*');
  ok('K4 anon still cannot read raw evaluations after publish', !!ev.error || ev.data.length === 0, 'n='+ev.data?.length);
  // unpublish
  const { error: un } = await owner.rpc('publish_results', { p_publish: false, p_total_judges: 2, p_total_teams: 15, p_total_submissions: 2, p_entries: [] });
  ok('K5 owner unpublishes', !un, JSON.stringify(un));
  const r2 = await anon.from('public_leaderboard').select('*');
  ok('K6 audience loses access after unpublish', !r2.error && r2.data.length === 0, 'n='+r2.data?.length);
}

// L: archive/reset lifecycle
{
  const { data: evals } = await owner.from('evaluations').select('id');
  const expected = evals.length;
  const entries = [{ teamId:'team-01', teamName:'Team 01', averageScore:10, totalScore:20, rank:1, submissionCount:expected }];
  const base = { p_event_name:'Rank Rush Test Event', p_archived_by:'Test Owner', p_entries:entries, p_total_judges:2, p_total_teams:15, p_total_submissions:expected, p_default_teams:teams, p_settings:{ timerDurationSeconds:300 } };
  const r1 = await owner.rpc('archive_and_reset_event', { ...base, p_expected_evals: expected + 5 });
  ok('L1 stale snapshot rejected', !!r1.error && /ratings changed/.test(r1.error.message), JSON.stringify(r1.error));
  const still = (await owner.from('evaluations').select('id')).data.length;
  ok('L2 evals intact after rejected reset', still === expected, 'n='+still);
  const r2 = await owner.rpc('archive_and_reset_event', { ...base, p_expected_evals: expected });
  ok('L3 archive+reset succeeds', !r2.error && typeof r2.data === 'string', JSON.stringify(r2.error));
  ok('L4 evaluations cleared', (await owner.from('evaluations').select('id')).data.length === 0);
  const { data: t } = await owner.from('teams').select('id');
  ok('L5 teams reseeded to 15', t.length === 15, 'n='+t.length);
  const { data: arch } = await owner.from('event_archives').select('*');
  const latest = arch.sort((a,b) => b.archived_at.localeCompare(a.archived_at))[0];
  ok('L6 archive saved with entries', arch.length >= 1 && latest.entries.length === 1, JSON.stringify({n:arch?.length}));
  const { data: s } = await owner.from('settings_event').select('*').single();
  ok('L7 reset reopens submissions, unpublishes', s.submissions_open === true && s.results_published === false, JSON.stringify(s));
}
console.log('phase3: '+pass+' pass, '+fail+' fail');
