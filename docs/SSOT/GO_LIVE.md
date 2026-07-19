# Go-live checklist — real users (not demo)

## Already done in code / infra

- [x] Supabase Postgres connected (`DATABASE_URL`, table `app_store`)
- [x] Google Auth env vars on Vercel (`AUTH_GOOGLE_*`, `AUTH_SECRET`, `AUTH_URL`)
- [x] Demo mode **off** unless `ALLOW_DEMO=true`
- [x] Anonymous session creation disabled
- [x] API routes gated: actor must own the `userId` via Google session
- [x] Free-text `narrative` field on candidate + job cards
- [x] Production site: https://jobs-ai-snowy.vercel.app

## Required from human (Google Cloud)

Without these, “Sign in with Google” fails in production:

1. Open [Google Cloud Credentials](https://console.cloud.google.com/apis/credentials)
2. OAuth 2.0 Client (Web) used for this app
3. **Authorized JavaScript origins**
   - `https://jobs-ai-snowy.vercel.app`
   - `http://localhost:3000` (local)
4. **Authorized redirect URIs**
   - `https://jobs-ai-snowy.vercel.app/api/auth/callback/google`
   - `http://localhost:3000/api/auth/callback/google`
5. OAuth consent screen
   - If status is **Testing**: add every real tester email under Test users
   - Or publish the app for broader access

## Optional but recommended

- [ ] `GOOGLE_GENERATIVE_AI_API_KEY` on Vercel (smarter chats; otherwise heuristic fallback)
- [ ] Rotate Google client secret + DB password (they were shared in chat once)
- [ ] Connect GitHub repo to Vercel for auto-deploy (link failed earlier; can retry in dashboard)

## Local demo (dev only)

```bash
ALLOW_DEMO=true
```

in `.env.local` — never set this on Vercel production for real users.
