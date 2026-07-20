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

### FR-MATCH
- Rank candidates for employers; show employer-approved jobs to candidates only
- Field-level follow-up questions apply to all candidates in that field
- Candidate flexibility score 1–10 (1 flexible, 10 exact match)

### FR-DATA
- Persist store in Supabase Postgres

### FR-UI
| ID | Requirement |
|---|---|
| FR-UI-01 | Global settings control (top corner): language, privacy, terms, report a problem, rate the app, about, admin portal (when allowed), default role switch |
| FR-UI-02 | Starting as employee/employer must succeed without opaque server errors |
| FR-UI-03 | App entry and admin portal must not hang indefinitely on loading |
| FR-UI-04 | Remember default role (employee/employer); home auto-opens that role’s screen (chat + jobs / chat + candidates) |
| FR-UI-05 | Screens paint shell UI immediately; hydrate chat/lists in the background — no full-page “טוען…” gate |
| FR-UI-06 | Every chat has a reset-conversation control |

### FR-EMPLOYER-JOBS
| ID | Requirement |
|---|---|
| FR-JOB-01 | Approved employers may publish multiple jobs |
| FR-JOB-02 | Employer screen filters by active job; each job has its own chat and candidate list |

## Non-goals (current POC)

- Zoom intake, WhatsApp, payments, native apps, trained custom ML models

## Open notes from product feedback

See `docs/SSOT/CHAT_AGENTS.md` for agent voice and behavior detail. Further chat feedback will be appended there and mapped to FR-CHAT-* IDs.
