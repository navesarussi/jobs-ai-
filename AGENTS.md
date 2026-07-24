<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

Single service: a Next.js 16 (Turbopack) app. Standard commands live in `package.json` (`dev`, `build`, `lint`, `test`). Tests use `tsx --test` over `src/domain` + `src/application` and need no DB or env.

Startup caveats (dependencies are already installed by the update script; these are the non-obvious runtime bits):

- Postgres is a hard requirement. `src/infrastructure/store.ts` throws `DATABASE_URL is not set` on any read/write and has no in-memory fallback. A local PostgreSQL 16 cluster plus a `shidukh` role/database (password `shidukh`) are provisioned in the VM image. Start the cluster before running the app or hitting any API/page that touches the store: `sudo pg_ctlcluster 16 main start` (it does not auto-start on boot). The `app_store` table auto-creates on first access — there are no migrations.
- The pg pool forces `ssl: { rejectUnauthorized: false }`, so the database must speak SSL. The local cluster ships with SSL on (snakeoil cert), which satisfies this; a plain non-SSL Postgres will fail to connect.
- `.env.local` is gitignored, so recreate it if missing. Minimum for local dev:
  `ALLOW_DEMO=true`, `AUTH_SECRET=<any random string>`, `AUTH_URL=http://localhost:3000`, `DATABASE_URL=postgresql://shidukh:shidukh@localhost:5432/shidukh`.
- `ALLOW_DEMO=true` enables demo login buttons (no Google OAuth needed) with seeded `demo-employee` / `demo-employer` users — the intended local test path. `AUTH_GOOGLE_ID/SECRET` are only needed for real Google sign-in.
- Gemini is optional: without `GOOGLE_GENERATIVE_AI_API_KEY` the AI intake falls back to a deterministic heuristic engine (`src/infrastructure/ai/heuristic.ts`), so chat still works end-to-end (`aiMode: "heuristic"`).
- `npm run lint` currently exits non-zero due to pre-existing `react-hooks/set-state-in-effect` errors in committed source (e.g. `src/app/employee/page.tsx`, `src/app/admin/page.tsx`) — this is a code state, not an environment problem.
