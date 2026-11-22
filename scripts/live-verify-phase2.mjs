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
const login = async n => { const c = createClient(URL, ANON); const { error } = await c.auth.signInWithPassword({ email: em(n), password: pw(n) }); return { c, error }; };

// C: owner admin powers
const { c: owner, error: oe } = await login('owner');
ok('C1 owner sign-in', !oe, JSON.stringify(oe));
{
  const { data, error } = await owner.from('admins').select('*');
  ok('C2 owner reads admins (is_admin)', !error && data.length === 1 && data[0].is_first_admin, JSON.stringify({error,n:data?.length}));
  const { data: q } = await owner.from('admin_quota').select('*').eq('id', true).single();
  ok('C3 quota count 1 (no fixed max any more)', q.count === 1, JSON.stringify(q));
}

// D: five candidates file join requests
for (const n of ['adm1','adm2','adm3','adm4','adm5']) {
  const { c } = await login(n);
  const row = { uid: uids[n], email: em(n), name: 'Candidate '+n, verification_code: '123456', status: 'pending', first_admin_email: em('owner'), first_admin_uid: uids.owner };
  const { error } = await c.from('admin_requests').insert(row);
  ok('D-'+n+' join request filed', !error, JSON.stringify(error));
}

// E: owner approves all five candidates - no fixed cap any more
for (const n of ['adm1','adm2','adm3','adm4','adm5']) {
  const { error } = await owner.rpc('approve_admin_request', { p_uid: uids[n], p_approved_by: 'Test Owner' });
  ok('E-'+n+' approved', !error, JSON.stringify(error));
}
{
  const results = await Promise.all([1,2,3].map(() => owner.rpc('approve_admin_request', { p_uid: uids.adm5, p_approved_by: 'Test Owner' })));
  ok('E2 repeat approvals rejected (no pending request)', results.every(r => !!r.error && /no pending request/.test(r.error.message)), JSON.stringify(results.map(r=>r.error?.message)));
  const { data: q } = await owner.from('admin_quota').select('*').eq('id', true).single();
  const { data: admins } = await owner.from('admins').select('uid');
  ok('E3 count 6 with 6 admin rows (owner + 5)', q.count === 6 && admins.length === 6, JSON.stringify({q, n: admins.length}));
}

// F: removals; adm5 ends as a non-admin again for section G
{
  const { error: rm } = await owner.rpc('remove_admin', { p_uid: uids.adm4 });
  ok('F1 remove adm4', !rm, JSON.stringify(rm));
  const { error: self } = await owner.rpc('remove_admin', { p_uid: uids.owner });
  ok('F2 cannot remove self', !!self && /yourself/.test(self.message), JSON.stringify(self));
  const { error: rm2 } = await owner.rpc('remove_admin', { p_uid: uids.adm5 });
  ok('F3 adm5 removed (non-admin again for G)', !rm2, JSON.stringify(rm2));
  const { data: admins } = await owner.from('admins').select('uid');
  const { data: q2 } = await owner.from('admin_quota').select('*').eq('id', true).single();
  ok('F4 final state 4 admins', admins.length === 4 && q2.count === 4, JSON.stringify({n:admins.length,c:q2.count}));
}

// G: non-admin cannot use admin RPCs
{
  const { c: jud } = await login('adm5'); // signed in but not admin
  const { error } = await jud.rpc('approve_admin_request', { p_uid: uids.adm5, p_approved_by: 'X' });
  ok('G1 non-admin approval denied', !!error && /admin only/.test(error.message), JSON.stringify(error));
  const { error: pub } = await jud.rpc('publish_results', { p_publish: true, p_total_judges: 0, p_total_teams: 0, p_total_submissions: 0, p_entries: [] });
  ok('G2 non-admin publish denied', !!pub && /admin only/.test(pub.message), JSON.stringify(pub));
  const { error: ar } = await jud.rpc('archive_and_reset_event', { p_event_name:'x', p_archived_by:'x', p_entries:[], p_total_judges:0, p_total_teams:0, p_total_submissions:0, p_expected_evals:0, p_default_teams:[], p_settings:{} });
  ok('G3 non-admin reset denied', !!ar && /admin only/.test(ar.message), JSON.stringify(ar));
}
console.log('phase2-part1: '+pass+' pass, '+fail+' fail');
