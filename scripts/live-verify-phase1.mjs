import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';
const URL = 'https://loiwlyqttlwatjimphks.supabase.co';
const ANON = 'sb_publishable_I9wglTINuVt3lmtnX2Jb3Q_AZl8eHFZ';
let pass = 0, fail = 0;
const ok = (name, cond, extra='') => { if (cond) { pass++; console.log('PASS '+name); } else { fail++; console.log('FAIL '+name+' '+extra); } };

// A: unauthenticated denial
const anon = createClient(URL, ANON);
{
  const r1 = await anon.from('public_leaderboard').select('*');
  ok('A1 anon sees nothing before publish', !r1.error && r1.data.length === 0, JSON.stringify({e:r1.error,n:r1.data?.length}));
  const r2 = await anon.from('evaluations').select('*');
  ok('A2 anon cannot read evaluations', !!r2.error || r2.data.length===0, 'n='+r2.data?.length);
  const r3 = await anon.from('teams').insert({id:'team-hack',name:'hack',project_title:'x',description:''});
  ok('A3 anon cannot insert teams', !!r3.error);
  const r4 = await anon.from('settings_event').update({event_name:'Hacked'}).eq('id',true).select();
  ok('A4 anon cannot update settings', !!r4.error || r4.data.length===0);
  const r5 = await anon.from('judges').select('*');
  ok('A5 anon cannot read judges', !!r5.error || r5.data.length===0);
  const r6 = await anon.from('admin_quota').select('*');
  ok('A6 anon cannot read admin_quota', !!r6.error || r6.data.length===0);
  const r7 = await anon.from('event_archives').select('*');
  ok('A7 anon cannot read archives', !!r7.error || r7.data.length===0);
}

// S: owner + 5 admin candidates sign up (email confirm disabled)
const uids = {};
for (const n of ['owner','adm1','adm2','adm3','adm4','adm5']) {
  const c = createClient(URL, ANON);
  const pw = readFileSync('/tmp/rr-'+n+'-pw','utf8').trim();
  const email = 'rr-'+n+'@rankrush.test';
  const { data, error } = await c.auth.signUp({ email, password: pw });
  ok('S-'+n+' signup', !error && data.user?.id, JSON.stringify(error));
  uids[n] = data.user?.id;
  // confirm immediate sign-in works (no email confirmation gate)
  const c2 = createClient(URL, ANON);
  const si = await c2.auth.signInWithPassword({ email, password: pw });
  ok('S-'+n+' immediate sign-in', !si.error && !!si.data.session, JSON.stringify(si.error));
}
writeFileSync('/tmp/rr-uids.json', JSON.stringify(uids,null,2));
console.log('OWNER_UID='+uids.owner);
console.log('phase1: '+pass+' pass, '+fail+' fail');
