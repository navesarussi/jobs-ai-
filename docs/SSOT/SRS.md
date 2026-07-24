# SRS — shidukh-poc (jobs AI matching)

Status: DRAFT/POC. Source of product truth.

## Product goal

Match employers and candidates **without search**. Agents extract rich profiles from natural conversation; ranking surfaces strong fits quickly so employers can approve the right person.

## Actors

- **Candidate (employee):** chats with agent; sees only jobs that approved them
- **Employer:** chats with agent; sees ranked candidates; approve / reject / field questions

## Functional requirements

### FR-AUTH
- Google OAuth available when `GOOGLE_AUTH_ENABLED=true` and Google credentials are set
- While Google is soft-disabled (`GOOGLE_AUTH_ENABLED` unset/false), open local sessions are allowed for chat development (Google code remains in the repo)
- Test login dialog (no Google) available when `ALLOW_TEST_LOGIN=true` (production internal testing) or in local dev with open auth
- Candidate entry at `/`; employer entry at `/for-employers` (separate landing URLs)
- Demo mode when `ALLOW_DEMO=true`
- API actions must be authorized for the acting user (or open-dev actor when Google is soft-disabled)

### FR-CARDS
- Candidate and job cards have many predefined fields (empty until filled)
- Cards include a **free-text / narrative** field (`narrative`)
- Matching and UI may use both structured fields and free text

### FR-CHAT-BOTH (applies to candidate agent AND employer agent)

| ID | Requirement |
|---|---|
| FR-CHAT-01 | Do **not** mention missing field counts, fill progress (`X/Y`), or “card completeness” explicitly |
| FR-CHAT-02 | Speak naturally and humanly; invite more detail without sounding like a form |
| FR-CHAT-03 | Ask only questions that are needed next — one clear thread at a time |
| FR-CHAT-04 | Conversation must feel like a **natural dialogue**, not a rigid interview script |
| FR-CHAT-05 | Adapt questions to the **specific role / field / context** already known; as more specifics emerge, questions become more specific |
| FR-CHAT-06 | Primary goal of chat: understand **as much as possible**, especially **personality / character / vibe**, not just hard skills |
| FR-CHAT-07 | Secondary goal: enable **fast + high-quality matches** |
| FR-CHAT-08 | For employers: optimize toward finding a **near-perfect fit** for that job |
| FR-CHAT-09 | Candidate agent resolves open contradictions (CV vs chat, chat vs chat) naturally, one thread at a time, without mentioning scores or “reliability” |
| FR-CHAT-10 | Candidate agent confirms or discards low-confidence CV inferences; resolutions update hidden reliability |

### FR-MATCH
- Rank candidates for employers; show employer-approved jobs to candidates only
- Field-level follow-up questions apply to all candidates in that field
- Candidate flexibility score 1–10 (1 flexible, 10 exact match)
- Employer/job flexibility score 1–10 (1 flexible on candidates, 10 exact match only)
- Matching blends candidate + job flexibility (average) before applying the score curve

### FR-DATA
- Persist store in Supabase Postgres

### FR-UI
| ID | Requirement |
|---|---|
| FR-UI-01 | Global settings control (top corner): language, privacy, terms, report a problem, rate the app, about, admin portal (when allowed), default role switch, **sign out** |
| FR-UI-02 | Starting as employee/employer must succeed without opaque server errors |
| FR-UI-03 | App entry and admin portal must not hang indefinitely on loading |
| FR-UI-04 | Remember default role (employee/employer); home auto-opens that role’s screen (chat + jobs / chat + candidates) |
| FR-UI-05 | Screens paint shell UI immediately; hydrate chat/lists in the background — no full-page “טוען…” gate |
| FR-UI-06 | Every chat has a reset-conversation control |
| FR-UI-07 | Chat sidebar: **admins only** see the full card field fill-in list; regular users see a **knowledge % bar** only (0% = no relevant knowledge, 100% = all relevant knowledge shared) |
| FR-UI-08 | Chat sidebar: employee and employer can **drag a flexibility slider** 1–10 (1 = very flexible, 10 = exact only); persists via API and affects matching |

### FR-EMPLOYER-JOBS
| ID | Requirement |
|---|---|
| FR-JOB-01 | Approved employers may publish multiple jobs |
| FR-JOB-02 | Employer screen filters by active job; each job has its own chat and candidate list |

### FR-CV (candidate résumé upload & deep analysis)
Design: `docs/superpowers/specs/2026-07-23-cv-deep-analysis-design.md`

| ID | Requirement |
|---|---|
| FR-CV-01 | Candidates may upload a CV (PDF/DOCX/TXT); the original file is persisted for later viewing |
| FR-CV-02 | AI performs deep, professional extraction into the candidate profile: structured card fields, work/education history, and unmapped facts so no explicit CV content is dropped |
| FR-CV-03 | Field provenance is retained; conflicting values from CV vs existing data are both kept; the candidate agent clarifies which value is current in chat (no silent overwrite) |
| FR-CV-04 | After upload, the candidate sees only a minimal summary that data was captured — not the full rich card (aligns with FR-UI-07) |
| FR-CV-05 | Admins may always view/download a candidate CV; employers may view/download only for candidates matched to their job (`queued` or `approved`) |
| FR-CV-06 | Controlled subtext inference with grounded evidence + confidence; high/medium may fill empty card fields; low waits for chat confirmation (policy C) |
| FR-CV-07 | Extraction quality gates reject repetitive/garbage text before it reaches the candidate card |
| FR-CV-08 | Work/education histories and mapped CV facts populate the full candidate card; the candidate mini-card remains a safe subset |
| FR-CV-09 | Each candidate has a hidden reliability score (0–100) plus contradiction notes (CV vs chat, chat vs chat, CV-internal); candidates never see this |
| FR-CV-10 | Knowledge % reflects fields filled from CV/chat on the full card, including non-empty work/education histories |

Design (subtext + reliability): `docs/superpowers/specs/2026-07-24-cv-subtext-reliability-design.md`

## Non-goals (current POC)

- Zoom intake, WhatsApp, payments, native apps, trained custom ML models

## Open notes from product feedback

See `docs/SSOT/CHAT_AGENTS.md` for agent voice and behavior detail. Further chat feedback will be appended there and mapped to FR-CHAT-* IDs.
