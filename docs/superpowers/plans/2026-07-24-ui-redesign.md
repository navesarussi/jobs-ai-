# CITOV UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the Blue Atmosphere Product redesign to design tokens, landing, employee, and employer surfaces while preserving brand colors and FR-UI behavior.

**Architecture:** Update `globals.css` tokens/motion first; add thin presentational primitives (`Panel`, `Button`, `SegmentedTabs`); restyle existing product components and pages in place. No domain/API changes. Admin and legal stay untouched.

**Tech Stack:** Next.js App Router, React client components, Tailwind CSS v4 (`@import "tailwindcss"`), CSS variables, Heebo, Hebrew RTL.

**Spec:** `docs/superpowers/specs/2026-07-24-ui-redesign-design.md`

## Global Constraints

- Keep brand colors: `#102a50`, `#3b82f6`, `#2563eb`, `#7dd3fc`, `#0f1f3d`
- Keep logo `/logo.png`, wordmark CITOV, tagline “There is another way”
- Atmosphere must not be flat white — layered blue backgrounds
- Medium motion; honor `prefers-reduced-motion`
- RTL with logical properties (`ms`/`me`/`ps`/`pe`)
- Max ~200 lines per file; split if exceeded
- No domain/API/auth behavior changes
- Landing currently candidate-first (no employer start CTA on home) — preserve existing auth flow; restyle only
- Pass 1 excludes `/admin` and `/legal/*`
- Mapped to SRS: FR-UI-01 … FR-UI-08 (visual only)

## File map

| File | Responsibility |
|------|----------------|
| `src/app/globals.css` | Tokens, atmosphere, motion utilities, panel class |
| `src/components/ui/Button.tsx` | primary / secondary / ghost / danger |
| `src/components/ui/Panel.tsx` | tinted surface wrapper |
| `src/components/ui/SegmentedTabs.tsx` | chat ↔ list control |
| `src/components/BrandMark.tsx` | spacing/hierarchy polish |
| `src/app/page.tsx` | Landing composition |
| `src/components/ChatPanel.tsx` | Chat chrome restyle |
| `src/components/ProfileAside.tsx` | Aside / knowledge bar restyle |
| `src/components/FileImport.tsx` | Import panel restyle |
| `src/components/FlexibilitySlider.tsx` | Slider chrome |
| `src/components/OpportunityList.tsx` | Job list rows |
| `src/components/CandidateQueue.tsx` | Candidate rows / actions |
| `src/components/SettingsMenu.tsx` | Settings trigger + sheet |
| `src/app/employee/page.tsx` | Employee shell |
| `src/app/employer/page.tsx` | Employer shell |

---

### Task 1: Design tokens + motion

**Files:**
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces: CSS vars `--bg`, `--surface`, `--panel-radius`, classes `.panel`, `.enter`, `.enter-delay`, `.enter-delay-2`, `.chat-msg`, `.typing-dots`, `.live-pulse`, `.brand-progress`, `.brand-gradient-bg`, `.brand-gradient-text` (keep aliases for existing usage)

- [ ] **Step 1: Rewrite `:root` and `body` atmosphere**

Set tokens per spec; body background:

```css
body {
  background:
    radial-gradient(ellipse 90% 55% at 10% -5%, rgba(59, 130, 246, 0.18), transparent 55%),
    radial-gradient(ellipse 70% 45% at 100% 0%, rgba(125, 211, 252, 0.22), transparent 50%),
    radial-gradient(ellipse 50% 35% at 50% 100%, rgba(16, 42, 80, 0.06), transparent 60%),
    linear-gradient(180deg, #eef5fb 0%, #e8f1f9 50%, #e3eef8 100%);
  color: var(--ink);
  font-family: var(--font-heebo), "Segoe UI", sans-serif;
  min-height: 100%;
}
```

Keep reduced-motion block. Update `.premium-panel` to stronger blue-tint panel OR alias `.panel` = same styles. Keep existing animation class names used by pages.

- [ ] **Step 2: Visual check**

Run: `npm run build` (or `npx tsc --noEmit` if faster)  
Expected: no CSS import errors; app compiles.

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "style: deepen blue atmosphere tokens and motion utilities"
```

---

### Task 2: UI primitives

**Files:**
- Create: `src/components/ui/Button.tsx`
- Create: `src/components/ui/Panel.tsx`
- Create: `src/components/ui/SegmentedTabs.tsx`

**Interfaces:**
- Produces:
  - `Button({ variant?: "primary" | "secondary" | "ghost" | "danger"; className?; ...button props })`
  - `Panel({ className?; children; as?: "div" | "aside" | "section" })`
  - `SegmentedTabs({ tabs: { id: string; label: string }[]; value: string; onChange: (id: string) => void })`

- [ ] **Step 1: Add `Button.tsx`** (~60 lines)

Primary = `bg-[var(--hero)]` hover `accent-strong`; secondary = border stroke + surface; ghost = text muted; danger = warn text. Min height ~44px for primary full-width uses via `className`.

- [ ] **Step 2: Add `Panel.tsx`**

Wrapper applying `panel` / `premium-panel` + `rounded-[1.5rem]`.

- [ ] **Step 3: Add `SegmentedTabs.tsx`**

Chip track `bg-[var(--chip)]`; active pill white/surface with hero text + soft shadow.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/
git commit -m "feat: add Button, Panel, and SegmentedTabs primitives"
```

---

### Task 3: Landing restyle

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/BrandMark.tsx`

**Interfaces:**
- Consumes: `BrandMark`, `SettingsMenu`, `Button` (optional)
- Preserves: existing `startCandidate`, Google sign-in, demo, auto-resume employee session

- [ ] **Step 1: Polish `BrandMark`**

Larger wordmark hierarchy; keep tagline muted; no layout logic change beyond spacing classes.

- [ ] **Step 2: Restyle home**

Remove boxed “form card” feel: CTA group without heavy premium panel wrapping everything — or use soft `Panel` with more air. Primary CTA filled hero/gradient; demo tertiary dashed. Keep SettingsMenu top corner. Stagger enter classes.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx src/components/BrandMark.tsx
git commit -m "style: redesign landing as branded blue atmosphere hero"
```

---

### Task 4: Shared product chrome

**Files:**
- Modify: `src/components/ChatPanel.tsx`
- Modify: `src/components/ProfileAside.tsx`
- Modify: `src/components/FileImport.tsx`
- Modify: `src/components/FlexibilitySlider.tsx`
- Modify: `src/components/SettingsMenu.tsx`
- Modify: `src/components/OpportunityList.tsx`
- Modify: `src/components/CandidateQueue.tsx`

**Interfaces:**
- Behavior unchanged; className / structure polish only
- Chat: accent user bubbles, surface assistant, reset secondary, typing + pulse kept
- Settings: FR-UI-01 actions unchanged

- [ ] **Step 1: Restyle ChatPanel** — panel shell, softer header gradient blue, composer focus ring
- [ ] **Step 2: Restyle ProfileAside + FlexibilitySlider + FileImport** — panel, knowledge bar, soft import
- [ ] **Step 3: Restyle SettingsMenu** — trigger + menu panel; keep fixed top-end
- [ ] **Step 4: Restyle OpportunityList + CandidateQueue** — list rows, soft chips, clear actions (approve = primary, reject = secondary)
- [ ] **Step 5: Commit**

```bash
git add src/components/ChatPanel.tsx src/components/ProfileAside.tsx src/components/FileImport.tsx src/components/FlexibilitySlider.tsx src/components/SettingsMenu.tsx src/components/OpportunityList.tsx src/components/CandidateQueue.tsx
git commit -m "style: restyle chat, aside, settings, and list chrome"
```

---

### Task 5: Employee + Employer shells

**Files:**
- Modify: `src/app/employee/page.tsx`
- Modify: `src/app/employer/page.tsx`

**Interfaces:**
- Consumes: `SegmentedTabs`, existing panels/lists
- Employee tabs: `chat` | `jobs`
- Employer tabs: `chat` | `candidates`
- Mobile: aside stacked below (grid order already does this)
- Employer job chips: active filled accent; new job dashed accent

- [ ] **Step 1: Employee header + SegmentedTabs + enter motion**
- [ ] **Step 2: Employer header + logo mark + SegmentedTabs + job chips restyle + enter/crossfade classes**
- [ ] **Step 3: Run build**

```bash
npm run build
```

Expected: success.

- [ ] **Step 4: Commit**

```bash
git add src/app/employee/page.tsx src/app/employer/page.tsx
git commit -m "style: unify employee and employer workspace shells"
```

---

### Task 6: Visual QA gate

- [ ] **Step 1:** Confirm admin/legal files untouched (`git diff --name-only` excludes them)
- [ ] **Step 2:** Manual checklist — landing hero, employee chat, employer chips, reduced-motion still in CSS, RTL logical props
- [ ] **Step 3:** Run existing unit tests

```bash
npm test
```

Expected: existing domain/application tests pass (no UI unit tests required).

---

## Spec coverage

| Spec section | Task |
|--------------|------|
| §3 Tokens / atmosphere | Task 1 |
| §4 Motion | Task 1 |
| §6 Primitives | Task 2 |
| §5.1 Landing | Task 3 |
| §5.3–5.4 Chat / aside | Task 4 |
| §5.5–5.6 Lists / employer jobs | Task 4–5 |
| §5.2 Shells | Task 5 |
| §9 Success criteria | Task 6 |
| Admin/legal deferred | Explicit non-touch |

