# Go-live checklist — real users (not demo)

## Already done in code / infra

- [x] Supabase Postgres connected (`DATABASE_URL`)
- [x] Google Auth env vars on Vercel (`AUTH_GOOGLE_*`, `AUTH_SECRET`, `AUTH_URL`)
- [x] Demo mode **off** unless `ALLOW_DEMO=true`
- [x] Anonymous session creation disabled
- [x] API routes gated: actor must own the `userId` via Google session
- [x] Free-text `narrative` field on candidate + job cards
- [x] Chat calls Gemini **only server-side** via `/api/chat` + `GOOGLE_GENERATIVE_AI_API_KEY`
- [x] Production site: https://jobs-ai-snowy.vercel.app
- [x] AI health: `GET /api/health/ai` → `{ geminiConfigured, mode }`

## Required: Gemini API key on Vercel (for human chat)

Without this, the UI shows **מצב מקומי** and uses heuristic fallback.

1. Open [Vercel → Project → Settings → Environment Variables](https://vercel.com/dashboard)
2. Add:
   - **Name:** `GOOGLE_GENERATIVE_AI_API_KEY`
   - **Value:** your Gemini API key (from [Google AI Studio](https://aistudio.google.com/apikey))
   - **Environments:** Production + Preview (+ Development if you use `vercel env pull`)
3. **Redeploy** Production (Deployments → … → Redeploy)
4. Verify: open `https://jobs-ai-snowy.vercel.app/api/health/ai` — expect `"geminiConfigured": true`

### CLI alternative (with a Vercel token)

```bash
export VERCEL_TOKEN=vercel_xxx   # https://vercel.com/account/tokens
export GEMINI_KEY='your-key'
npm run set-gemini-env
# then redeploy in the Vercel dashboard
```

## After deploy — prompts

- Default prompts live in `prompts/candidate/system-prompt.md` and `prompts/employer/system-prompt.md`
- Admin portal can override them live; use **איפוס לברירת מחדל** to pick up the latest file prompts
- Check `GET /api/health/ai` and chat badge (Gemini vs מצב מקומי)

## Required from human (Google Cloud OAuth)

Without these, “Sign in with Google” fails in production:

1. Open [Google Cloud Credentials](https://console.cloud.google.com/apis/credentials)
2. OAuth 2.0 Client (Web) used for this app
3. **Authorized JavaScript origins**
   - `https://citov.tech`
   - `https://jobs-ai-snowy.vercel.app`
   - `http://localhost:3000` (local)
4. **Authorized redirect URIs**
   - `https://citov.tech/api/auth/callback/google`
   - `https://jobs-ai-snowy.vercel.app/api/auth/callback/google`
   - `http://localhost:3000/api/auth/callback/google`
5. OAuth consent screen
   - If status is **Testing**: add every real tester email under Test users
   - Or publish the app for broader access

## Security notes

- Never commit API keys to git (`.env*` is gitignored except `.env.example`)
- Rotate any key that was pasted in chat
- Gemini key is read only in server code (`src/infrastructure/ai/intake.ts`) — never sent to the browser

## Local demo (dev only)

```bash
ALLOW_DEMO=true
```

in `.env.local` — never set this on Vercel production for real users.
