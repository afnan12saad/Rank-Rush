import { createClient } from '@supabase/supabase-js';

// Rank Rush backend: Supabase project "Rank Rush Event" (Mumbai, ap-south-1).
// Separate project from the old "Rank Rush" backend; the old database is untouched.
// The publishable anon key is public by design; all data access is enforced
// server-side by Postgres Row Level Security and RPCs (see supabase/schema.sql).
export const SUPABASE_URL = 'https://loiwlyqttlwatjimphks.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_I9wglTINuVt3lmtnX2Jb3Q_AZl8eHFZ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
});
