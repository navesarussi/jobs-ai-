# Design: Professional CV Subtext Analysis + Hidden Reliability

**Date:** 2026-07-24  
**Status:** Approved for implementation planning  
**Builds on:** `docs/superpowers/specs/2026-07-23-cv-deep-analysis-design.md`  
**SRS:** FR-CV-01…05 (extended), FR-CV-06…10 (new), FR-CHAT-09…10 (new), FR-UI-07, FR-CARDS, FR-DATA

## Problem

1. CV extraction is single-pass, explicit-only, and lacks output quality gates (LLM degeneration / repetitive text can land on the card).
2. Subtext (seniority signals, management clues, career trajectory, gaps) is deliberately ignored today.
3. Structured histories (`workHistory`, `educationHistory`) and leftovers live on `emp.cv` but are not fully projected onto the active `CandidateCard`, so knowledge % under-counts what we know.
4. Contradictions (CV vs chat, chat vs chat) are only partially tracked; there is no hidden reliability score for admins/matching, and the chat agent is not driven to resolve them.

## Goals

- Professional, maximal CV analysis: explicit facts + **controlled subtext inference**.
- **Inference policy C:** `high`/`medium` fill empty card fields; `low` becomes chat prompts (never silent invent on the active card).
- **All** extracted traits land on the full candidate card (admin / matching / internal). Mini-card for the candidate stays a safe subset.
- Knowledge % rises when CV (and chat) fill relevant card fields / extras.
- **Hidden reliability** per candidate: numeric score + human-readable contradiction notes. Candidate never sees it. Chat’s job includes resolving contradictions to raise the score.
- Quality gate: reject repetitive / garbage AI or extract text before merge.

## Non-goals

- Showing reliability, full histories, or full field lists to the candidate.
- Replacing chat with CV-only profiles.
- Training a custom ML model.
- Employer-facing reliability UI in this iteration (score is stored and available; admin UI first; matching may consume score later).

## Architecture

```text
Upload → extractText → qualityPrecheck
  → Pass A: structured extraction (histories + explicit fields)
  → Pass B: controlled subtext inference (evidence + confidence)
  → sanitizeExtraction (reject loops, cap lengths)
  → mergeCvIntoEmployee (policy C + conflicts + evidence)
  → projectHistoriesOntoCard
  → recomputeReliability
  → persist
  → knowledge % from filled card rows (existing)

Chat turn
  → intake with pendingConflicts + openReliabilityNotes + lowInferences
  → apply patch with conflict-on-change (no silent overwrite of differing values)
  → resolveConflictsFromPatch
  → recomputeReliability
  → persist
```

Layers stay Clean Architecture: Domain (merge, sanitize predicates, reliability math) ← Application (orchestration) ← Infrastructure (Gemini, HTTP, UI).

## Inference policy C (locked)

| Confidence | Empty card field | Non-empty different value |
|---|---|---|
| `high` / `medium` | Fill card + `fieldEvidence` (`source: cv`, confidence) | Open conflict; do not overwrite |
| `low` | Do **not** fill card; push `PendingInference` for chat | Same — chat only |

Every inference (any confidence) must include `evidence` (short quote or paraphrase grounded in CV text). No evidence → drop.

Explicit CV facts (no inference) behave as today’s merge: fill empty, union arrays, conflict on differ, leftovers → `unmappedFacts` / mappable `extras`.

## Data model

### Active card (`CandidateCard`) — full internal profile

Extend with structured histories (already exist on `CandidateCvProfile`; **also** live on the card so matching + knowledge see them):

| Field | Purpose |
|---|---|
| `workHistory[]` | Roles with company, title, dates, description, achievements |
| `educationHistory[]` | Institutions / programs |
| (existing fields) | Filled from explicit + high/medium inference |
| `extras` | Mappable leftovers from unmapped facts when no fixed key |

`narrative` = short professional summary only (never raw CV dump; hard cap).

### CV profile (`CandidateCvProfile`) — provenance + pending work

| Field | Purpose |
|---|---|
| `documents[]` | File + `extractedText` + `extractionStatus` |
| `fieldEvidence[]` | Provenance |
| `conflicts[]` | Dual values pending chat resolution |
| `unmappedFacts[]` | Explicit leftovers |
| `pendingInferences[]` | **New** — low-confidence subtext for chat |
| `reliability` | **New** — score + notes (or on `EmployeeRecord`; prefer `cv.reliability` colocated with conflicts) |

### Pending inference

```ts
type PendingInference = {
  id: string;
  fieldKey: string;
  value: string;
  evidence: string;
  confidence: "low";
  status: "pending" | "accepted" | "rejected";
  at: string;
};
```

### Reliability (hidden)

```ts
type ReliabilityNote = {
  id: string;
  kind: "cv_vs_chat" | "chat_internal" | "cv_internal" | "unresolved_inference";
  fieldKey?: string;
  summary: string; // Hebrew/English factual note for admin
  status: "open" | "resolved";
  createdAt: string;
  resolvedAt?: string;
};

type CandidateReliability = {
  score: number; // 0–100
  notes: ReliabilityNote[];
  updatedAt: string;
};
```

**Visibility:** never returned on candidate `/api/me`. Admin APIs and internal matching store may read it. Employer UI out of scope for v1.

**Score (deterministic domain):**

```
base = 100
- 15 × open (cv_vs_chat | chat_internal)
- 10 × open cv_internal
- 5  × open unresolved_inference | pending low inferences
clamp 0..100
```

Recompute after every CV merge and every chat turn that touches conflicts / inferences / differing patches.

## Quality gates (bug class: repetitive “word salad”)

Before merge:

1. **Extract precheck:** if `extractedText` has extreme n-gram repetition or near-zero alphabetic diversity → `extractionStatus: failed`, do not call deep AI (or call only after clean).
2. **AI output sanitize:** drop/truncate any string field with:
   - length over caps (`narrative` ≤ 400, most strings ≤ 300, list items ≤ 80);
   - repeated token loops (same 4+ gram ≥ 3 times);
   - near-duplicate of full raw CV.
3. If sanitize removes >50% of patch content → mark `partial` and keep document for retry.

## Card vs mini-card vs knowledge %

| Surface | Content |
|---|---|
| Full card (admin / matching / strip knowledge calc) | All `CANDIDATE_FIELD_META` + histories + `extras` |
| Mini-card (candidate expandable) | Existing `MINI_KEYS` only — no reliability, no raw histories dump, no unmapped dump |
| Knowledge % | `knowledgePercent(candidateRows)` — treat `workHistory` / `educationHistory` as filled when non-empty; exclude `flexibility`; exclude reliability |

CV fill of empty fields automatically raises knowledge %. Histories count as two additional meta keys in `CANDIDATE_FIELD_META`.

## Chat behavior changes

Extend FR-CHAT / `CHAT_AGENTS.md`:

1. **Resolve open contradictions** (CV vs chat, chat vs chat) — one thread at a time, naturally.
2. **Probe pending low inferences** when no higher-priority conflict — confirm or discard.
3. **Raise reliability** by resolving notes (never mention the score or “reliability” to the user).
4. Intake schema may return optional `consistencyFlags[]` / answers that resolve inferences; domain still owns score math.

Chat patch rule change: if a patch sets a field to a **different** non-empty value than the card already has → open `chat_internal` (or `cv_vs_chat` if evidence source is cv) conflict instead of silent overwrite; keep prior card value until resolved (same as CV merge). Exception: explicit user correction that matches a pending conflict option → resolve.

## AI extraction (two passes)

**Pass A — structured (temp ~0.1):**
explicit fields + full `workHistory` / `educationHistory` + `unmappedFacts`.

**Pass B — subtext (temp ~0.2):**
given Pass A JSON + CV text, emit `inferences[]`: `{ fieldKey, value, evidence, confidence }`.
Allowed examples: management from “led a team of N”; seniority from years+titles; industry from role sequence; gaps → `unmappedFacts` or notes, not invented employers.

Orchestration in application/infrastructure; domain only merges sanitized results.

## Error handling

| Case | Behavior |
|---|---|
| Bad extract text | `failed`; card unchanged; user can re-upload |
| Pass A fails | heuristic minimal or keep pending; document retained |
| Pass B fails | keep Pass A only; no inferences |
| Sanitize strips garbage | merge remaining; `partial` |
| Unauthorized reliability read | omit field / 403 |

## Testing (mandatory)

- Sanitize rejects repetitive loops; caps narrative
- Policy C: high fills empty; low → pendingInference only
- Histories on card raise knowledge %
- Reliability score drops on open conflict, rises on resolve
- Chat differing patch opens conflict (no silent overwrite)
- `/api/me` for employee does not include `reliability`
- Mini-card keys unchanged (no reliability / full history list)

## SRS mapping (to add)

| ID | Requirement |
|---|---|
| FR-CV-06 | Controlled subtext inference with evidence + confidence; policy C |
| FR-CV-07 | Extraction quality gates; no garbage/repetition on card |
| FR-CV-08 | Histories and mapped facts populate the full candidate card; mini-card stays subset |
| FR-CV-09 | Hidden reliability score + contradiction notes on the candidate profile |
| FR-CV-10 | Knowledge % reflects CV-filled card fields including histories |
| FR-CHAT-09 | Agent resolves CV/chat and chat/chat contradictions without naming scores |
| FR-CHAT-10 | Agent confirms or discards low-confidence inferences; resolutions update reliability |

## Implementation notes

Detailed tasks: `docs/superpowers/plans/2026-07-24-cv-subtext-reliability.md`.
