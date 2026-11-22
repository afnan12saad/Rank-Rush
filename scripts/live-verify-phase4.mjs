import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';
const URL = 'https://loiwlyqttlwatjimphks.supabase.co';
const ANON = 'sb_publishable_I9wglTINuVt3lmtnX2Jb3Q_AZl8eHFZ';
const uids = JSON.parse(readFileSync('/tmp/rr-uids.json','utf8'));
const pw = n => readFileSync('/tmp/rr-'+n+'-pw','utf8').trim();
const em = n => 'rr-'+n+'@rankrush.test';
let pass = 0, fail = 0;
const ok = (name, cond, extra='') => { if (cond) { pass++; console.log('PASS '+name); } else { fail++; console.log('FAIL '+name+' '+extra); } };

const owner = createClient(URL, ANON);
await owner.auth.signInWithPassword({ email: em('owner'), password: pw('owner') });

// R: exact race - 4 admins, 1 seat, 5 concurrent candidates
const raceUids = [];
{
  const { data: admins } = await owner.from('admins').select('uid');
  ok('R0 precondition: 4 admins, 1 seat', admins.length === 4, 'n='+admins.length);
  for (let i = 1; i <= 5; i++) {
    const c = createClient(URL, ANON);
    const { data, error } = await c.auth.signUp({ email: em('race'+i), password: pw('race'+i) });
    if (error && /already/i.test(error.message)) {
      await c.auth.signInWithPassword({ email: em('race'+i), password: pw('race'+i) });
      const { data: u } = await c.auth.getUser();
      raceUids.push(u.user.id);
    } else {
      raceUids.push(data.user.id);
    }
    const row = { uid: raceUids[i-1], email: em('race'+i), name: 'Race '+i, verification_code: String(100000+i), status: 'pending', first_admin_email: em('owner'), first_admin_uid: uids.owner };
    await c.from('admin_requests').delete().eq('uid', raceUids[i-1]); // idempotent reruns (admin-only, will no-op for self)
    const { error: ie } = await c.from('admin_requests').upsert({ ...row }, { onConflict: 'uid' });
    ok('R-race'+i+' pending request ready', !ie, JSON.stringify(ie));
  }
  const results = await Promise.all(raceUids.map(u => owner.rpc('approve_admin_request', { p_uid: u, p_approved_by: 'Race Test' })));
  const wins = results.filter(r => !r.error).length;
  const losses = results.filter(r => !!r.error && /admin limit of 5/.test(r.error.message)).length;
  ok('R1 exactly one of five concurrent approvals wins the seat', wins === 1 && losses === 4, JSON.stringify(results.map(r => r.error ? r.error.message : 'WIN')));
  const { data: q } = await owner.from('admin_quota').select('*').eq('id', true).single();
  const { data: admins2 } = await owner.from('admins').select('uid');
  ok('R2 count 5 with 5 rows after race', q.count === 5 && admins2.length === 5, JSON.stringify({c:q.count,n:admins2.length}));
  const extra = await owner.rpc('approve_admin_request', { p_uid: raceUids[4], p_approved_by: 'Race Test' });
  ok('R3 no further approvals at cap', !!extra.error, 'no error');
  // free the seat again: remove whoever won
  const winnerIdx = results.findIndex(r => !r.error);
  await owner.rpc('remove_admin', { p_uid: raceUids[winnerIdx] });
  const { data: q2 } = await owner.from('admin_quota').select('*').eq('id', true).single();
  ok('R4 seat freed again, back to 4', q2.count === 4, JSON.stringify(q2));
  writeFileSync('/tmp/rr-race-uids.json', JSON.stringify(raceUids));
}

// M: direct Data API admin CRUD (table grants, not RPCs)
{
  const ins = await owner.from('teams').insert({ id: 'team-tmp', name: 'Tmp', project_title: 'x', description: '', presentation_status: 'Waiting', order_index: 99, tie_breaker_rank: 99 });
  ok('M1 admin inserts team via Data API', !ins.error, JSON.stringify(ins.error));
  const upd = await owner.from('teams').update({ name: 'Tmp2' }).eq('id', 'team-tmp').select();
  ok('M2 admin updates team', !upd.error && upd.data.length === 1, JSON.stringify(upd.error));
  const del = await owner.from('teams').delete().eq('id', 'team-tmp').select();
  ok('M3 admin deletes team', !del.error && del.data.length === 1, JSON.stringify(del.error));
  const se = await owner.from('settings_event').update({ event_name: 'Rank Rush Test Event' }).eq('id', true).select();
  ok('M4 admin updates settings', !se.error && se.data.length === 1, JSON.stringify(se.error));
  const jd = await owner.from('judges').delete().eq('email', 'nobody@rankrush.test');
  ok('M5 admin judges delete grant works (0 rows ok)', !jd.error, JSON.stringify(jd.error));
  const ed = await owner.from('evaluations').delete().eq('id', 'no-such-eval');
  ok('M6 admin evaluations delete grant works (0 rows ok)', !ed.error, JSON.stringify(ed.error));
  const rej = await owner.from('admin_requests').update({ status: 'rejected' }).eq('uid', raceUids[3]).select();
  ok('M7 admin can reject a request via Data API', !rej.error && rej.data.length === 1 && rej.data[0].status === 'rejected', JSON.stringify(rej.error));
  await owner.from('admin_requests').update({ status: 'pending' }).eq('uid', raceUids[3]);
}

// N: same writes denied for judge/anon via Data API
{
  const j = createClient(URL, ANON);
  await j.auth.signInAnonymously();
  const t1 = await j.from('teams').insert({ id: 'team-hack2', name: 'x', project_title: 'x', description: '' });
  ok('N1 judge cannot insert teams', !!t1.error, JSON.stringify(t1.data));
  const t2 = await j.from('settings_event').update({ event_name: 'Hacked' }).eq('id', true).select();
  ok('N2 judge cannot update settings', !!t2.error || t2.data.length === 0);
  // RLS silently filters rows a policy hides, so prove survival, not error shape:
  const { data: reg } = await j.rpc('register_judge', { p_name: 'Judge Del', p_email: 'jdel@rankrush.test' });
  await j.rpc('submit_score', { p_judge_id: reg.id, p_team_id: 'team-01', p_criteria: {c1:3,c2:3,c3:3,c4:3,c5:3}, p_comment: '' });
  const evalId = reg.id + '_team-01';
  await j.from('evaluations').delete().eq('id', evalId);
  const t3 = await j.from('evaluations').select('id').eq('id', evalId);
  ok('N3 judge delete leaves own evaluation intact', !t3.error && t3.data.length === 1, JSON.stringify(t3));
  await j.from('judges').delete().eq('id', reg.id);
  const t4 = await j.from('judges').select('id').eq('id', reg.id);
  ok('N4 judge delete leaves own judges row intact', !t4.error && t4.data.length === 1, JSON.stringify(t4));
  const t5 = await j.from('admin_requests').update({ status: 'approved' }).eq('uid', raceUids[0]).select();
  ok('N5 judge cannot self-approve via admin_requests update', !!t5.error || t5.data.length === 0, JSON.stringify(t5.data));
  const a = createClient(URL, ANON);
  const r1 = await a.from('admin_requests').select('*');
  ok('N6 anon cannot read admin_requests (no code/email leak)', !!r1.error || r1.data.length === 0, 'n='+r1.data?.length);
  const r2 = await a.from('admin_requests').insert({ uid: uids.owner, email: 'x@x.test', name: 'x' });
  ok('N7 anon cannot insert admin_requests', !!r2.error);
  const r3 = await j.from('admin_requests').insert({ uid: uids.owner, email: 'spoof@x.test', name: 'spoof' });
  ok('N8 signed-in non-admin cannot file a request under owner UID', !!r3.error, JSON.stringify(r3.data));
}

// V: requester sees only own request row; verification_code grants nothing
{
  const c = createClient(URL, ANON);
  await c.auth.signInWithPassword({ email: em('race1'), password: pw('race1') });
  const r = await c.from('admin_requests').select('*');
  ok('V1 requester reads only own request row', !r.error && r.data.length === 1 && r.data[0].uid === raceUids[0], 'n='+r.data?.length);
  const j = createClient(URL, ANON);
  await j.auth.signInAnonymously();
  const ap = await j.rpc('approve_admin_request', { p_uid: raceUids[1], p_approved_by: 'code-bypass' });
  ok('V2 knowing nothing but a UID cannot approve (code grants no authority)', !!ap.error && /admin only/.test(ap.error.message), JSON.stringify(ap.error));
}
console.log('phase4: '+pass+' pass, '+fail+' fail');
