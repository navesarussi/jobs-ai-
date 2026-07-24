# CODE QUALITY — shidukh-poc

Architecture: Domain ← Application ← Infrastructure / App.

- Max ~200 lines per file where practical
- Domain has zero framework imports
- AI provider swappable (Gemini / heuristic)
- Product chat behavior is defined in `docs/SSOT/CHAT_AGENTS.md` and SRS FR-CHAT-*
- Chat intake uses `generateObject({ system, messages })` with full recent history; match rebuild is deferred via `after()`
- Hot paths: `assertActor` loads an **actor slice** (self profile/chat/prompts only); list endpoints use opportunity/queue slices
- Interactive writes use `scoped-store` (per-user upsert / chat insert / chat clear / match status) — not whole-DB `persistStore`
- Match rebuild deferred via `after()` + `readMatchingStore()` (cards+matches, no chats)
- In-process full-store cache invalidated on writes; DB pool default max 12 (`DB_POOL_MAX`), prefer cached pooler host on connect
- Admin prompts: live DB override + reset-to-file defaults (`DELETE /api/admin/prompts`)
- [PENDING REFACTOR]: split `scoped-store.ts` / `slice-store.ts` / `application/chat.ts` under 200-line cap
- [PENDING REFACTOR]: SQL-scope field-question broadcast (still rare full-store path)

## Data layer (Supabase)

- Normalized tables + JSONB card columns (`employee_profiles.card`, `employer_profiles.card`)
- Runtime expansion via `extras` on cards; employer field questions merge into `extras`
- `card_field_definitions` for optional metadata on dynamic keys (no DDL per new question)
- Legacy `app_store` blob auto-migrated on first read after deploy
- DB pool: DNS-filter pooler candidates then probe in small batches; cache last-good URL per instance
- Session start uses `upsertSessionRole` (no full-store rewrite)
- Default pooler preference: `aws-1` / `ap-south-1` (prod `resolvedHost`); override via `SUPABASE_POOLER_*`
- Google OAuth soft-disabled via `GOOGLE_AUTH_ENABLED` (open local sessions while false)
- Test login (`ALLOW_TEST_LOGIN=true`) exposes dev sign-in dialog in production without Google
- Employer multi-job: `jobs` jsonb + `matches.job_id`; active job drives chat/candidates
- Chat persistence: `chat_messages.conversation_context` (`employee`|`employer`) + optional `job_id` — never key chats by `owner_user_id` alone
- Schema bootstrap: additive `ALTER`s (incl. `conversation_context`) run after `CREATE TABLE IF NOT EXISTS`; context index lives in ALTERS so existing DBs migrate without failing on missing columns
- [PENDING REFACTOR]: split `SettingsMenu.tsx` under 200-line cap
- [PENDING REFACTOR]: split `domain/cv-merge.ts` under 200-line cap
- [PENDING REFACTOR]: split `application/chat.ts` under 200-line cap after CV reliability work
- [PENDING REFACTOR]: during CV subtext work, prefer new files (`cv-sanitize.ts`, `reliability.ts`, `cv-extraction.ts`) over growing `intake.ts` / `cv-merge.ts` further
- Settings sign-out clears `shidukh_user` + NextAuth session (when present) and returns to `/`
- [PENDING REFACTOR]: restore employer/admin UI entry points (home role picker, settings default-role, admin menu) after candidate CITOV rebrand phase
