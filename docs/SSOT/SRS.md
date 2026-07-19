# SRS — shidukh-poc (jobs AI matching)

Status: DRAFT/POC. Source of product truth.

## Product goal

Match employers and candidates **without search**. Agents extract rich profiles from natural conversation; ranking surfaces strong fits quickly so employers can approve the right person.

## Actors

- **Candidate (employee):** chats with agent; sees only jobs that approved them
- **Employer:** chats with agent; sees ranked candidates; approve / reject / field questions

## Functional requirements

### FR-AUTH
- Google OAuth required for real users
- Demo mode only when `ALLOW_DEMO=true` (dev)
- API actions must be authorized for the acting user

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

## Non-goals (current POC)

- Zoom intake, WhatsApp, payments, native apps, trained custom ML models

## Open notes from product feedback

See `docs/SSOT/CHAT_AGENTS.md` for agent voice and behavior detail. Further chat feedback will be appended there and mapped to FR-CHAT-* IDs.
