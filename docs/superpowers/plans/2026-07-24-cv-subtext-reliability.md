# Professional CV Subtext + Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deep CV analysis with controlled subtext (policy C), full-card population, knowledge-% accuracy, quality gates against garbage extraction, and a hidden reliability score driven by contradiction resolution in chat.

**Architecture:** Enrich existing `/api/cv` → `/api/cv/analyze` → `mergeCvIntoEmployee` pipeline with preprocess + two-pass Gemini extraction + sanitize; project histories onto `CandidateCard`; deterministic `recomputeReliability`; chat opens conflicts on differing patches and feeds open notes/inferences into the system prompt.

**Tech Stack:** Next.js, Gemini `generateObject`, Zod, domain merge/reliability pure functions, existing scoped-store persistence.

## Global Constraints

- Clean Architecture: Domain ← Application ← Infrastructure
- Max ~200 lines/file where practical (split new helpers rather than grow `cv-merge.ts` / `intake.ts`)
- Docs/SRS in English; UI Hebrew via i18n
- Map to FR-CV-06…10, FR-CHAT-09…10
- TDD for domain sanitize, merge policy C, reliability, chat conflict-on-change
- Candidate never sees reliability or full rich dump (FR-UI-07 / FR-CV-04)

## File map

| File | Role |
|---|---|
| `docs/SSOT/SRS.md` | Add FR-CV-06…10, FR-CHAT-09…10 |
| `docs/SSOT/CHAT_AGENTS.md` | Contradiction + inference confirmation goals |
| `src/domain/types.ts` | Histories on card; pendingInferences; reliability types |
| `src/domain/cv-sanitize.ts` | Repetition / length gates |
| `src/domain/cv-sanitize.test.ts` | Tests |
| `src/domain/reliability.ts` | Score + note recompute |
| `src/domain/reliability.test.ts` | Tests |
| `src/domain/cv-merge.ts` | Policy C merge + project histories + pending inferences |
| `src/domain/cv-merge.test.ts` | Extend tests |
| `src/domain/card-fields.ts` | Meta keys for workHistory / educationHistory |
| `src/domain/card-progress.ts` | Treat histories as filled when non-empty |
| `src/domain/candidate-mini-card.ts` | Keep MINI_KEYS subset (no reliability) |
| `src/infrastructure/ai/schemas.ts` | Pass A/B schemas + inference schema |
| `src/infrastructure/ai/intake.ts` | Two-pass extraction + sanitize hook |
| `src/application/cv-import.ts` | Orchestrate analyze + reliability |
| `src/application/chat.ts` | Conflict-on-change; resolve inferences; reliability |
| `src/infrastructure/ai/prompts.ts` | Inject open notes + pending inferences |
| `prompts/candidate/system-prompt.md` | FR-CHAT-09/10 voice rules |
| `src/app/api/me/route.ts` | Omit reliability for employees |
| `src/app/admin/page.tsx` (or admin candidate view) | Show score + notes when available |
| `src/application/cv-import.test.ts` / `chat.turn.test.ts` | Application tests |

---

### Task 1: SRS + agent docs

**Files:**
- Modify: `docs/SSOT/SRS.md`
- Modify: `docs/SSOT/CHAT_AGENTS.md`
- Reference: `docs/superpowers/specs/2026-07-24-cv-subtext-reliability-design.md`

- [ ] **Step 1: Extend FR-CV and FR-CHAT in SRS**

Append under FR-CV:

```markdown
| FR-CV-06 | Controlled subtext inference with grounded evidence + confidence; high/medium may fill empty card fields; low waits for chat confirmation (policy C) |
| FR-CV-07 | Extraction quality gates reject repetitive/garbage text before it reaches the candidate card |
| FR-CV-08 | Work/education histories and mapped CV facts populate the full candidate card; the candidate mini-card remains a safe subset |
| FR-CV-09 | Each candidate has a hidden reliability score (0–100) plus contradiction notes (CV vs chat, chat vs chat, CV-internal); candidates never see this |
| FR-CV-10 | Knowledge % reflects fields filled from CV/chat on the full card, including non-empty work/education histories |
```

Append under FR-CHAT-BOTH:

```markdown
| FR-CHAT-09 | Candidate agent resolves open contradictions (CV vs chat, chat vs chat) naturally, one thread at a time, without mentioning scores or “reliability” |
| FR-CHAT-10 | Candidate agent confirms or discards low-confidence CV inferences; resolutions update hidden reliability |
```

- [ ] **Step 2: Update CHAT_AGENTS.md north star**

Add goals:

```markdown
4. Resolve contradictions between CV and chat (and within chat) without meta language.
5. Confirm weak CV inferences gently; never invent facts.
```

Under Anti-patterns add: mentioning reliability score or “סתירות במערכת”.

- [ ] **Step 3: Commit**

```bash
git add docs/SSOT/SRS.md docs/SSOT/CHAT_AGENTS.md docs/superpowers/specs/2026-07-24-cv-subtext-reliability-design.md
git commit -m "docs: CV subtext inference + hidden reliability requirements"
```

---

### Task 2: Domain types

**Files:**
- Modify: `src/domain/types.ts`
- Test: compile via later unit tests

**Interfaces:**
- Produces: `PendingInference`, `ReliabilityNote`, `CandidateReliability`; `CandidateCard.workHistory` / `educationHistory`; `CandidateCvProfile.pendingInferences` / `reliability`

- [ ] **Step 1: Add types to `types.ts`**

```ts
export type PendingInference = {
  id: string;
  fieldKey: string;
  value: string;
  evidence: string;
  confidence: "low";
  status: "pending" | "accepted" | "rejected";
  at: string;
};

export type ReliabilityNote = {
  id: string;
  kind: "cv_vs_chat" | "chat_internal" | "cv_internal" | "unresolved_inference";
  fieldKey?: string;
  summary: string;
  status: "open" | "resolved";
  createdAt: string;
  resolvedAt?: string;
};

export type CandidateReliability = {
  score: number;
  notes: ReliabilityNote[];
  updatedAt: string;
};
```

On `CandidateCard` add:

```ts
workHistory: WorkHistoryEntry[];
educationHistory: EducationHistoryEntry[];
```

On `CandidateCvProfile` add:

```ts
pendingInferences: PendingInference[];
reliability: CandidateReliability;
```

Update `emptyCandidateCard()` / `emptyCvProfile()` defaults (`workHistory: []`, `educationHistory: []`, `pendingInferences: []`, `reliability: { score: 100, notes: [], updatedAt: "" }`).

- [ ] **Step 2: Commit**

```bash
git add src/domain/types.ts
git commit -m "feat(domain): card histories + pending inferences + reliability types"
```

---

### Task 3: Sanitize (quality gates)

**Files:**
- Create: `src/domain/cv-sanitize.ts`
- Create: `src/domain/cv-sanitize.test.ts`

**Interfaces:**
- Produces: `hasRepetitiveLoop(text)`, `sanitizeCvPatch(input)`, `isExtractTextUsable(text)`

- [ ] **Step 1: Write failing tests**

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hasRepetitiveLoop, isExtractTextUsable, sanitizeCvPatch } from "./cv-sanitize";

describe("cv-sanitize", () => {
  it("detects repeated n-gram loops", () => {
    const loop = "cleanly overall focus pathways ".repeat(12);
    assert.equal(hasRepetitiveLoop(loop), true);
    assert.equal(hasRepetitiveLoop("Senior engineer at Acme, 2019–2024."), false);
  });

  it("rejects unusable extract text", () => {
    assert.equal(isExtractTextUsable("a".repeat(50)), false);
    assert.equal(isExtractTextUsable("Software engineer with 5 years in payments."), true);
  });

  it("strips looping narrative and caps length", () => {
    const out = sanitizeCvPatch({
      patch: { narrative: "focus pathways correctly ".repeat(40), desiredRole: "Engineer" },
      unmappedFacts: [{ label: "x", value: "cleanly overall ".repeat(30) }],
    });
    assert.ok(!out.patch.narrative || out.patch.narrative.length <= 400);
    assert.ok(!(out.patch.narrative ?? "").includes("focus pathways correctly focus pathways"));
    assert.equal(out.patch.desiredRole, "Engineer");
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
node --import tsx --test src/domain/cv-sanitize.test.ts
```

- [ ] **Step 3: Implement `cv-sanitize.ts`**

Rules:
- `hasRepetitiveLoop`: tokenize; if any 4-gram appears ≥ 3 times → true
- `isExtractTextUsable`: length ≥ 40; not almost all identical chars; not `hasRepetitiveLoop`
- Caps: narrative 400, summary 200, other strings 300, list item 80
- Drop string values that fail loop check; drop unmapped facts that fail
- Return `{ ...input, strippedCount }` for callers

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/domain/cv-sanitize.ts src/domain/cv-sanitize.test.ts
git commit -m "feat(domain): CV extraction quality sanitize gates"
```

---

### Task 4: Reliability domain

**Files:**
- Create: `src/domain/reliability.ts`
- Create: `src/domain/reliability.test.ts`

**Interfaces:**
- Consumes: `FieldConflict[]`, `PendingInference[]`, existing `CandidateReliability`
- Produces: `recomputeReliability(...)`, `openReliabilityNote(...)`, `resolveReliabilityNotesForField(...)`

- [ ] **Step 1: Write failing tests**

```ts
it("starts at 100 with no open issues", () => {
  const r = recomputeReliability({ conflicts: [], pendingInferences: [], prior: undefined });
  assert.equal(r.score, 100);
});

it("penalizes open cv_vs_chat conflicts and recovers on resolve", () => {
  const open = recomputeReliability({
    conflicts: [{ id: "1", fieldKey: "location", values: [], status: "pending" }],
    pendingInferences: [],
    prior: undefined,
    noteSeed: [{ id: "n1", kind: "cv_vs_chat", fieldKey: "location", summary: "CV: TLV vs chat: Haifa", status: "open", createdAt: "t" }],
  });
  assert.equal(open.score, 85);
  const closed = recomputeReliability({
    conflicts: [{ id: "1", fieldKey: "location", values: [], status: "resolved", resolvedValue: "TLV" }],
    pendingInferences: [],
    prior: open,
    noteSeed: [{ ...open.notes[0], status: "resolved", resolvedAt: "t2" }],
  });
  assert.equal(closed.score, 100);
});
```

Formula (lock):

```
score = clamp(100 - 15*openConflictNotes - 10*openCvInternal - 5*pendingLowInferences, 0, 100)
```

Where `openConflictNotes` = notes with status open and kind in `cv_vs_chat|chat_internal`.

- [ ] **Step 2: Implement + pass tests + commit**

```bash
git commit -m "feat(domain): hidden candidate reliability score"
```

---

### Task 5: Merge policy C + project histories onto card

**Files:**
- Modify: `src/domain/cv-merge.ts` (split helpers into `src/domain/cv-inference-merge.ts` if over ~200 lines)
- Modify: `src/domain/cv-merge.test.ts`
- Modify: `src/domain/card-fields.ts`
- Modify: `src/domain/card-progress.ts`

**Interfaces:**
- Extends `CvPatchInput` with `inferences?: { fieldKey, value, evidence, confidence: "high"|"medium"|"low" }[]`
- `mergeCvIntoEmployee` applies policy C, appends `pendingInferences`, projects histories onto `card`, calls `recomputeReliability`

- [ ] **Step 1: Failing tests for policy C**

```ts
it("high inference fills empty field; low becomes pendingInference only", () => {
  const { employee } = mergeCvIntoEmployee(emp(), {
    patch: {},
    inferences: [
      { fieldKey: "managementExperience", value: "כן", evidence: "led a team of 8", confidence: "high" },
      { fieldKey: "personality", value: "יסודי", evidence: "detail-oriented wording", confidence: "low" },
    ],
  }, doc);
  assert.equal(employee.card.managementExperience, "כן");
  assert.equal(employee.card.personality, "");
  assert.equal(employee.cv?.pendingInferences.length, 1);
  assert.equal(employee.cv?.pendingInferences[0].fieldKey, "personality");
});

it("projects workHistory onto card and counts toward knowledge", () => {
  const { employee } = mergeCvIntoEmployee(emp(), {
    patch: {},
    workHistory: [{ company: "Acme", title: "Dev" }],
  }, doc);
  assert.equal(employee.card.workHistory.length, 1);
  const rows = candidateRows(employee.card);
  assert.ok(rows.find((r) => r.key === "workHistory")?.filled);
});
```

- [ ] **Step 2: Add field meta**

In `card-fields.ts`:

```ts
{ key: "workHistory", label: "היסטוריית תעסוקה", priority: 9.5 },
{ key: "educationHistory", label: "היסטוריית השכלה", priority: 15.5 },
```

(Use integer priorities if needed: 9 and keep education at 15 — adjust ordering without breaking existing keys; prefer `priority: 9` insert by renumbering only if tests depend on order.)

In `card-progress.ts` / `cardValue`: ensure array histories use `!isEmpty` (length > 0). Update `formatCardValue` to summarize histories briefly (e.g. `"N תפקידים"`) so admin rows stay readable.

- [ ] **Step 3: Implement merge changes**

- Explicit patch: existing rules
- For each inference with evidence:
  - low → `pendingInferences` only
  - high/medium + empty field → set card + evidence
  - high/medium + different → conflict + reliability note `cv_vs_chat`
- After histories append on `cv`, also set `card.workHistory` / `card.educationHistory` to the merged arrays
- Map leftover unmappedFacts into empty `extras[label]` when label is a sane key
- End with `cv.reliability = recomputeReliability(...)`
- When opening conflicts, add reliability note with Hebrew/English summary text

- [ ] **Step 4: Tests pass + commit**

```bash
git commit -m "feat(domain): CV policy C merge + histories on card"
```

---

### Task 6: Two-pass AI extraction + wire analyze

**Files:**
- Modify: `src/infrastructure/ai/schemas.ts`
- Modify: `src/infrastructure/ai/intake.ts` (extract CV helpers to `src/infrastructure/ai/cv-extraction.ts` if needed)
- Modify: `src/application/cv-import.ts`
- Modify: `src/application/cv-import.test.ts`

**Interfaces:**
- `runCvExtraction` returns patch + histories + unmapped + inferences + provider + usage
- Application runs sanitize → merge

- [ ] **Step 1: Extend schemas**

```ts
export const cvInferenceSchema = z.object({
  fieldKey: z.string(),
  value: z.string(),
  evidence: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
});

export const cvExtractionSchema = z.object({
  patch: candidatePatchSchema,
  workHistory: z.array(workHistoryEntrySchema).optional(),
  educationHistory: z.array(educationHistoryEntrySchema).optional(),
  unmappedFacts: z.array(unmappedFactSchema).optional(),
  fieldConfidence: z.record(z.string(), z.enum(["high", "medium", "low"])).optional(),
  inferences: z.array(cvInferenceSchema).optional(),
});
```

- [ ] **Step 2: Implement two-pass in intake/cv-extraction**

Pass A system: explicit-only structured extract (current rules 1–8 without inventing).  
Pass B system: subtext only; every item needs evidence; confidence required; no new employers/dates invented.

```ts
// Pseudocode
if (!isExtractTextUsable(text)) return { patch: {}, provider: "heuristic", failed: true };
const passA = await generateObject(...cvExtractionSchema without relying on inferences...);
const passB = await generateObject(...{ inferences: z.array(cvInferenceSchema) }...);
const merged = { ...passA, inferences: passB.inferences };
return sanitizeCvPatch(merged);
```

On Gemini failure: keep Pass A if present; never pretend deep subtext succeeded.

- [ ] **Step 3: `analyzeCandidateCv`**

```ts
const extracted = await runCvExtraction(...);
if (extracted.failed) { mark document failed; return; }
const sanitized = sanitizeCvPatch(extracted);
const applied = applyCvExtraction(..., { ...sanitized, inferences: sanitized.inferences });
```

Status: `ok` | `partial` (heuristic or stripped) | `failed`.

- [ ] **Step 4: Tests + commit**

```bash
git commit -m "feat(ai): two-pass CV extraction with subtext inferences"
```

---

### Task 7: Chat conflict-on-change + reliability + prompts

**Files:**
- Modify: `src/application/chat.ts`
- Modify: `src/domain/cv-merge.ts` (`resolveConflictsFromPatch`, add `resolvePendingInferencesFromPatch`)
- Modify: `src/infrastructure/ai/prompts.ts`
- Modify: `prompts/candidate/system-prompt.md`
- Modify: `src/application/chat.turn.test.ts`

- [ ] **Step 1: Domain — resolve inferences when patch accepts value**

```ts
export function resolvePendingInferencesFromPatch(
  cv: CandidateCvProfile | undefined,
  patch: Partial<CandidateCard>,
  now = new Date().toISOString(),
): CandidateCvProfile | undefined
```

If patch sets `fieldKey` equal to pending value → `accepted`; if sets different explicit answer → still mark resolved/rejected per match; recompute reliability.

- [ ] **Step 2: Chat apply — no silent overwrite**

Replace blind `applyCandidatePatch` for employee turns with merge that:
- empty → fill
- same → ok
- different → open `chat_internal` conflict + reliability note; keep old card value

Then `resolveConflictsFromPatch` + `resolvePendingInferencesFromPatch` + `recomputeReliability`.

- [ ] **Step 3: Prompt injection**

Extend `buildEmployeeConversation` with:

```ts
pendingInferences?: string;
openReliabilityNotes?: string;
```

Append blocks (Hebrew, internal):

```
הסקות חלשות מהקו״ח לאישור (אל תציין שמדובר ב״הסקה״ או ציון):
- ...

סתירות פתוחות לבירור:
- ...
```

Update `system-prompt.md` goals: resolve contradictions; confirm weak signals; never mention reliability/knowledge %.

- [ ] **Step 4: Tests**

- Differing chat patch opens conflict, card unchanged
- Resolving via patch raises reliability score
- Prompt builder includes inference lines when present

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(chat): resolve contradictions and CV inferences for reliability"
```

---

### Task 8: API visibility + admin surface + mini-card guard

**Files:**
- Modify: `src/app/api/me/route.ts`
- Modify: `src/domain/candidate-mini-card.ts` / tests
- Modify: `src/app/admin/page.tsx` or candidate admin component if present
- Modify: `src/components/CandidateProfileStrip.tsx` only if needed for knowledge (should auto-update via `candidateRows`)

- [ ] **Step 1: `/api/me` employee payload**

Do **not** include `cv.reliability`, `pendingInferences`, full `workHistory` dump beyond what’s already on `card` if card is returned — card may include histories for knowledge calc on client.

**Decision locked:** Employee `card` in `/api/me` may include histories for knowledge %, but UI mini-card must not render them. Strip `reliability` from any nested `cv` if exposed. Prefer returning `card` as today + `hasCv` metadata; if full card is already sent, ensure `CandidateProfileStrip` / mini-card still uses `MINI_KEYS` only (histories not in `MINI_KEYS`).

- [ ] **Step 2: Mini-card test**

```ts
it("does not expose workHistory or reliability keys", () => {
  const lines = candidateMiniCardLines(cardWithHistories, labels);
  assert.ok(!lines.some((l) => l.key === "workHistory"));
});
```

- [ ] **Step 3: Admin**

Where admin views a candidate, show `Reliability: {score}` and list open/resolved note summaries. If no dedicated admin candidate panel exists, add a compact block on admin page data fetch — minimal, no candidate-facing UI.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(ui): hide reliability from candidates; show in admin"
```

---

### Task 9: Verification

- [ ] **Step 1: Unit tests**

```bash
npm test
```

Expected: all domain/application tests pass including new sanitize/reliability/merge/chat cases.

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Manual smoke**

1. Upload a clean CV → fields + histories fill; knowledge % rises; mini-card stays small.
2. Upload/fixture with repetitive AI-like text → sanitize strips; no word-salad on card.
3. Create CV vs chat conflict → reliability &lt; 100; chat asks; resolve → score recovers.
4. Employee `/api/me` JSON has no `reliability`.

- [ ] **Step 4: Final commit if fixes needed**

```bash
git commit -m "test: verify CV subtext + reliability pipeline"
```

---

## Spec coverage checklist

| Spec section | Task |
|---|---|
| Policy C | Task 5 |
| Quality gates | Task 3, 6 |
| Histories on full card + mini subset | Task 2, 5, 8 |
| Knowledge % | Task 5 (`card-progress`) |
| Hidden reliability | Task 4, 5, 7, 8 |
| Chat resolve contradictions / inferences | Task 7 |
| Two-pass AI | Task 6 |
| SRS / CHAT_AGENTS | Task 1 |
