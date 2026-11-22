# Rank Rush

Live site : https://rank-rush.pages.dev

Smart project evaluation and live judging platform: judges score teams on five
criteria (0-5 each, total /25), a live admin-only projector shows the animated
leaderboard, and the audience sees aggregate standings only after an admin
publishes them.

- React 19 + TypeScript + Vite + Tailwind 4 frontend
- Supabase (free plan) backend: Postgres RLS + RPCs enforce every rule server-side
- **No limit on admin accounts**: each new admin is approved by an existing
  admin, and approval is enforced in the database, not just the UI
- Judges join with name + email (anonymous sign-in) and can only ever see their
  own scores
- "Start New Event" archives the standings, then resets teams/scores so the same
  project can be reused for the next event

## Run locally

```bash
npm install
npm run dev
```


Node 20+ recommended. `npm run lint` typechecks, `npm run build` builds for
production, and `npx tsx --test src/utils/scoring.test.ts` runs the unit tests.

## Backend

The app talks to the Supabase project configured in
`src/services/supabaseClient.ts` (publishable anon key, public by design; all
access is enforced by row-level security). The complete schema of record,
including RLS policies, RPCs, grants and single-row seeds, is
`supabase/schema.sql` - apply it in the Supabase SQL editor on a fresh project.

Owner setup, admin management and operations: see **RANK-RUSH-SETUP.md**.

## Verification scripts

`scripts/live-verify-phase1..3.mjs` are the live backend verification suites
(anon/judge denial boundaries, admin cap atomicity, publish/reset lifecycle).
They expect throwaway test accounts; see the file headers and RANK-RUSH-SETUP.md.
