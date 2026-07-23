# Design: CITOV UI Redesign — Blue Atmosphere Product

**Date:** 2026-07-24  
**Status:** Approved (brainstorm)  
**SRS mapping:** FR-UI-01 … FR-UI-08 (visual/UX only; no behavior change)  
**Out of scope (pass 1):** Admin portal, legal/about pages, domain/API logic

---

## 1. Goal

Redesign the customer-facing product UI so CITOV feels like a modern, light, professional AI company: conversational matching without search, calm blue atmosphere, medium motion — while keeping existing brand colors, logo, and tagline.

**Keep:** logo (`/logo.png`), wordmark CITOV, tagline “There is another way”, palette core (`#102a50`, `#3b82f6`, `#2563eb`, `#7dd3fc`, `#0f1f3d`), Hebrew RTL, Heebo.

**Ignore:** existing layout patterns, card chrome, and visual hierarchy (except brand assets above).

---

## 2. Scope

### Pass 1 (this design)

1. Design system: tokens, typography scale, motion utilities, base components  
2. Landing (auth / role start)  
3. Employee workspace (chat + approved jobs + profile aside)  
4. Employer workspace (job chips + chat + candidates + profile aside)

### Explicitly deferred

- Admin (`/admin`)
- Legal pages (`/legal/*`)
- New product features (CV UX beyond existing controls, matching logic, etc.)

---

## 3. Visual direction — Blue Atmosphere Product

Not flat white. Layered cool-blue atmosphere; soft tinted surfaces; brand gradient only at key moments (logo moments, knowledge progress, special CTAs).

### 3.1 Color tokens

| Token | Value | Role |
|-------|--------|------|
| `--ink` | `#0f1f3d` | Primary text |
| `--hero` | `#102a50` | Strong titles, primary filled CTAs |
| `--accent` | `#3b82f6` | Actions, links, user chat bubbles |
| `--accent-strong` | `#2563eb` | Hover / pressed primary |
| `--sky` | `#7dd3fc` | Soft highlights |
| `--muted` | `#6b7c93` | Secondary text |
| `--stroke` | `#d5e3f0` | Borders |
| `--bg` | layered `#eef5fb` → `#e3eef8` | Page atmosphere (not pure white) |
| `--surface` | tinted near-white (`#f7fbfe` / color-mix) | Panels |
| `--chip` | `#e2eef9` | Segmented track, soft fills |
| `--bubble` | `#e8f2fc` | Soft selected / hover fills |
| `--brand-gradient` | `135deg, #102a50 → #3b82f6 → #7dd3fc` | Progress, brand accents only |
| `--shadow` / `--shadow-soft` | navy-tinted, soft | Elevation |

Warn tokens remain for warnings only; not a visual theme driver.

### 3.2 Typography

- Font: **Heebo** (Hebrew + Latin) — unchanged family
- Scale:
  - **Display** — landing brand / hero line
  - **Title** — workspace page titles
  - **Body** — chat and lists
  - **Caption** — meta, hints
- Wordmark `CITOV`: bold, wide tracking (`~0.2em`), hero color
- Tagline: light weight, muted

### 3.3 Shape & depth

- Radius: `12–20px` controls; `20–28px` panels
- Borders: 1px stroke; no heavy card grids
- Shadows: soft navy-tinted only where interaction or separation needs it
- Surfaces only when they aid interaction or content separation (no decorative cards)

---

## 4. Motion (medium)

Respect `prefers-reduced-motion: reduce` (disable decorative motion).

| Moment | Behavior | Approx duration |
|--------|----------|-----------------|
| Page enter | Staggered rise + fade: header → main → aside | 350–550ms, stagger 80–120ms |
| Chat message | Short slide-up + fade | ~280ms |
| AI thinking | Typing dots + soft live pulse | looping, subtle |
| Knowledge bar | Width transition on update | ~300ms |
| Tab / job switch | Content crossfade | ~200ms |
| Hover / focus | Border/color; optional 1–2px lift | 150–200ms |

No dramatic spring, no heavy glow, no continuous full-screen gradient animation.

---

## 5. Screens

### 5.1 Landing

**One composition (first viewport):**

1. Atmosphere background (blue radial layers)
2. Large `BrandMark` (logo + CITOV + tagline) as hero
3. One short supporting sentence (placement through conversation — no search)
4. One CTA group:
   - Primary filled: start as candidate
   - Secondary soft/outline: start as employer
   - Google / demo as tertiary under the group
5. Settings control in the top corner (FR-UI-01)

**Not on first viewport:** feature grids, stats, cards, secondary marketing blocks.

**Entry motion:** logo → wordmark → copy → CTAs (stagger).

**Mobile:** same story, stacked; CTAs full-width, thumb-friendly.

### 5.2 Shared workspace shell (employee + employer)

- Slim header: small logo + CITOV + user name + Settings
- Segmented tabs for primary modes
- **Desktop:** chat as center column; profile aside secondary
- **Mobile:** full-width tabs; profile aside stacked below the active panel (no drawer in pass 1)
- Shell paints immediately; lists/chat hydrate in background (FR-UI-05)

### 5.3 Chat (shared)

- Tinted `Panel`, not heavy card chrome
- User bubbles: accent fill, white text
- Assistant bubbles: light surface + soft stroke
- Composer pinned bottom; accent focus ring; filled send
- Reset conversation control visible and secondary (FR-UI-06)
- File import (existing capability) restyled to match kit — no new behavior

### 5.4 Profile aside (FR-UI-07, FR-UI-08)

- Knowledge % bar with brand-gradient fill
- Flexibility slider 1–10
- Full field checklist: **admins only**
- Regular users: knowledge bar + hint + slider only

### 5.5 Employee — jobs tab

- Airy list rows: title, field/meta, soft status chip
- Subtle hover / enter; no dashboard card walls
- Empty state: calm muted copy + pointer back to chat if useful

### 5.6 Employer — jobs + candidates

- Job chip row: active = filled accent; create = dashed accent outline
- Switching jobs crossfades chat + candidate list (~200ms)
- Candidate rows: identity, match signal, Approve / Reject clear actions
- Same visual language as employee; only content differs

---

## 6. Component kit (pass 1)

| Component | Purpose |
|-----------|---------|
| `Button` | primary / secondary / ghost / danger |
| `SegmentedTabs` | chat ↔ list |
| `Panel` | tinted surface (replaces ad-hoc premium-panel usage on product screens) |
| `ChatBubble` | user / assistant / system presentation |
| `ChatComposer` | input + send |
| `TypingIndicator` | AI thinking |
| `KnowledgeBar` | percent + gradient fill |
| `FlexibilitySlider` | restyle existing control |
| `JobChip` / `StatusChip` | job select + status |
| `ListRow` | opportunity / candidate row |
| `SettingsSheet` | existing settings actions, new chrome |
| `BrandMark` | brand only; spacing/hierarchy polish |

Implementation may map these to existing files (`ChatPanel`, `SettingsMenu`, etc.) via restyle/refactor rather than mandatory new file per name — behavior and SRS requirements stay intact.

---

## 7. Architecture constraints

- **UI only** in `src/app` (landing, employee, employer) + `src/components` + `src/app/globals.css`
- No domain imports into new presentational primitives beyond existing patterns
- No change to matching, chat agents, auth flows, or API contracts
- RTL-first; mirror spacing with logical properties (`ms`/`me`/`ps`/`pe`)
- File size / complexity caps per CODE QUALITY remain in force; split components if a screen file grows past ~200 lines during restyle

---

## 8. Accessibility

- Focus visible rings (accent)
- Progressbar semantics on knowledge bar (already present — keep)
- Contrast: ink on atmosphere/surfaces meets readable contrast; white text only on accent/hero fills
- Motion reduced when preferred
- Interactive targets ≥ ~44px on mobile CTAs

---

## 9. Success criteria

1. Landing reads as one branded composition with blue atmosphere (not a white form page)
2. Employee and employer share one shell language; chat is visually primary
3. Brand gradient appears sparingly and intentionally
4. Medium motion is noticeable on enter/chat/tab switch, never noisy
5. All FR-UI-01…08 behaviors preserved
6. Admin and legal unchanged in pass 1

---

## 10. Implementation order

1. Tokens + `globals.css` motion utilities  
2. Base components / shared primitives  
3. Landing  
4. Employee workspace  
5. Employer workspace  
6. Visual QA (desktop + mobile, RTL, reduced motion)

---

## 11. Non-goals

- Dark mode
- Purple / generic “AI glow” aesthetic
- Rewriting copy/i18n keys except where labels must match new UI structure
- Redesigning admin or legal in this pass
