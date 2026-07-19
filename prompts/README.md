# AI agent prompts

Single source of truth for intake agent system prompts.  
Product behavior: `docs/SSOT/CHAT_AGENTS.md` · SRS **FR-CHAT-01 … FR-CHAT-08**.

## Layout

| Folder | Agent | Used when |
|---|---|---|
| `prompts/candidate/` | Candidate (employee) intake | Free-text chat that fills the candidate card |
| `prompts/employer/` | Employer intake | Free-text chat that fills the job card |

Each folder contains `system-prompt.md` — the main template.  
Placeholders use `{{double_braces}}` and are filled at runtime by the AI layer.

## Placeholders (shared)

| Placeholder | Description |
|---|---|
| `{{new_message}}` | Latest user message |
| `{{chat_history}}` | Recent conversation (last ~16 turns) |
| `{{current_card}}` | JSON snapshot of the card being filled |
| `{{missing_field_key}}` | Suggested next field key, or empty if deepening |
| `{{pending_field_questions}}` | Employer field questions waiting for answers (candidate only) |

## Editing workflow

1. Edit the `.md` template in the relevant folder.
2. Keep voice rules from `CHAT_AGENTS.md` (no fill-count talk, natural dialogue, one thread at a time).
3. Wire templates into `src/infrastructure/ai/intake.ts` when ready (not yet connected in POC).

## Not in scope here

- Match-reason enrichment (`enrichReasonWithAi`) — stays inline until extracted.
- Heuristic fallback copy — `src/infrastructure/ai/heuristic.ts`.
