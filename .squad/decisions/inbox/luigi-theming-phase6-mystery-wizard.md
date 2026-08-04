# Theming Phase 6 — The Mystery Wizard: judgment calls & new gaps

**By:** Luigi (Frontend Developer)
**Date:** 2026-08-02

---

### 1. `--color-on-success` does not exist; the wizard-complete bubble needs it (NEW CATALOGUE GAP)

**What:** `mystery-create.scss`'s complete-phase bubble was `bg-emerald-500 border-emerald-500 text-white`. The fill/border repoint onto `--color-success` cleanly. The **text** has no token: the Catalogue has `--color-success` but no `--color-on-success`, unlike every other fill role (`on-accent`, `on-danger`, `on-toast-*`, `on-badge-*`, `on-weapon-chip`). Shipped `@apply ... text-on-accent` as an explicitly-commented placeholder.

**Why:** Leaving the literal `text-white` is actively wrong at Phase 7. Rosalina's dark value for `--color-success` is `emerald-400` (`#34d399`) — white text on that is **~1.9:1** (recomputed; an earlier draft of this note said ~1.7:1), far under the 4.5:1 floor and illegible either way. By contrast the shipped placeholder resolves to `slate-900` (`#0f172a`) on `emerald-400`, which is **~9.3:1**. Her table note ("Lightened for the same surface-legibility reason as accent/danger") shows she reasoned about `success` as a *text/icon colour on a surface* and did not consider it as a *fill with content on top*, which is the only way this app actually uses it. `--color-on-accent` (light `white` → dark `slate-900`) already holds exactly the values an `on-success` token would hold under her own lighten-and-flip construction, so the placeholder is numerically correct in both themes today and at Phase 7 — it is only semantically wrong (a success surface reading an accent token).

**Ask:** add `--color-success`'s partner `--color-on-success` to the Catalogue (Category A, inside the existing `@theme static` block) with Rosalina's value; then swap the two `@apply` sites in `mystery-create.scss`. Same shape as the `--color-surface-hover` gap I filed in Phase 2. This is the *only* consumer in the app.

---

### 2. Submit-error banner's border → `border-default`, not a danger colour (JUDGMENT CALL)

**What:** the banner was `bg-red-50 border border-red-200 rounded-md text-red-600`. Shipped as `bg-danger-subtle border border-default rounded-md text-danger`.

**Why:** there is no "danger line/border" token, and neither available candidate is right — `border-danger-subtle` equals the fill exactly in light mode (the hairline vanishes), and `border-danger` (light `red-600`) is a 4-step jump from `red-200` and reads as an alarm outline. Rosalina's own Error/Unhappy-Path section describes this exact element as "a soft red-tinted wash behind `red-400` text… a calm 'something needs attention' banner, not an alarm" and never mentions a danger-coloured border — the redness is carried by fill + text. `--color-border`'s documented role *is* "standard hairline border", which is the role this element's border actually plays. Light-mode effect: `red-200` → `slate-200` on a 1px hairline.

**Alternative if disagreed:** a `--color-danger-line` token, mirroring `--color-weapon-chip-line` (which exists for the same reason: a border is a third role, not an `on-*` role). Not proposing it unilaterally — one consumer today.

---

### 3. Deliberate light-mode shade shifts (all measured, all following existing precedent)

Verified by measuring the pre-change (`git stash`) and post-change builds in the live browser with structural-only selectors: **46 of 57 measured properties are byte-identical in light mode.** The 11 that shifted:

| Element | Before | After | Rationale |
|---|---|---|---|
| Form/countdown/inline input borders (4 sites) | `slate-200` | `border-strong` (`#c9d4e6`) | The plan's own instruction ("`--color-border-strong` for inputs"); identical to the Phase 3 detail-page repoint. |
| Input focus border | `indigo-500` | `border-accent` (`indigo-600`) | Same substitution Phase 3 shipped on all detail-page forms. |
| Phase-bubble border / tracker line / Back button border | `slate-300` | `border-strong` (`#c9d4e6`) | 1-unit RGB delta — imperceptible. |
| Sub-item card border (10 sites) | `#e5e9f2` | `border-default` (`slate-200`) | 3-unit delta; the Catalogue itself calls `#e5e9f2` an "imperceptibly-close alias" of `--color-border`. |
| Sub-item row divider | `slate-100` | `border-default` (`slate-200`) | One step; matches `monster-detail`'s structurally identical sub-resource rows (Phase 5). |
| Error banner fill | `red-50` | `danger-subtle` (`red-100`) | The Catalogue names the error banner as a `--color-danger-subtle` consumer. |
| Error banner border | `red-200` | `border-default` | See item 2. |

Everything else — every surface, every text colour, the accent fills, the emerald complete states, the weapon chip, the amber badge — is byte-identical.

---

### 4. Step-dot / tracker-line inactive fills use `bg-border` and `bg-border-strong`

`--color-border` and `--color-border-strong` are Category B (hand-written `border-default`/`border-strong` utilities), but they *also* still auto-generate `bg-border`/`bg-border-strong`, which are not stuttering names and emit real rules (verified by probe build). Used deliberately to preserve the original 200-vs-300 distinction between the inactive step dot (`slate-200`) and the inactive tracker line / bubble border (`slate-300`). The alternative (`bg-surface-hover`) has an identical dark value and a near-identical light value but a misleading role name.

---

### 5. Amber adventure-type badge stays literal (consistent with Phases 4/5)

`mystery-create-dossier.html`'s adventure-type badge keeps `bg-amber-100 text-amber-700`. `--color-badge-mystery` is explicitly reserved-and-unvalued. This is now the **third** place this same literal badge lives (`mysteries-list.html`, `mystery-detail.html`, `mystery-create-dossier.html`) — it is the only intentional literal colour left in the wizard, and the only pair that showed no delta in the two-theme diff. Phase 7's sweep will find all three; they should be left alone until the mystery-badge token is real.

---

### 6. For Phase 7 — pre-existing issues found while verifying, NOT fixed (out of scope)

- **`monsterTypeId` is `Validators.required` in `mystery-create.store.ts`'s `monsterForm` but has no `*` in `mystery-create-monster-phase.html`.** Phase 1 of the wizard silently refuses to advance with no visible reason if Monster Type is left unset — there is no `@if (...invalid && ...touched)` error message for it either, unlike `name` and `monsterArchetypeId`. Found because it blocked my Playwright walkthrough. Not a theming issue; not touched. Worth a real fix.
- **Backward tracker-bubble navigation into an already-submitted phase, followed by walking forward with Next, re-submits that phase and duplicates its child entities.** Reproduced deterministically (isolated probe, light mode, no theming involved): reach phase 2 → click the *complete* phase-1 bubble → press Next twice → **two identical `POST /api/mysteries/{id}/monsters` requests**, `monsterCount: 2`, two monsters with the same name. `submitCurrentPhase()` has no "already submitted this phase" guard. Note the precise condition is broader than my first draft of this note said: the phase does *not* have to be incomplete — `isPhaseAccessible` (= `phase === currentPhase || phaseComplete[phase]`) happily lets you re-enter a completed phase, and Next re-POSTs on the way out. `isPhaseAccessible` separately makes forward jumps into a *never-completed* phase impossible (bubble stays `disabled`), which is the mechanism that forces the Next-walk in the first place. Pre-existing; identical in both themes; unrelated to Phase 6. Circumstantial evidence it has already bitten real use: the dev database currently holds four monsters named "The Miller", two locations named "The Old Mill" and two bystanders named "Deputy Marsh" under hand-created mysteries, none of which I created.
- **A phase bubble that is both `complete` and `active` renders as complete (green), not active (indigo)** — `.complete` follows `.active` in `mystery-create.scss` at equal specificity, so it wins. Consequence: after jumping backward into a finished phase, the tracker gives no "you are here" indication at all; all you see is a row of green bubbles. Source order is **unchanged by Phase 6** (the pre-change literals had the identical order), so this is pre-existing, not a repoint regression — but it's now more visible in dark mode, where `emerald-400` and `indigo-400` are closer in luminance than `emerald-500`/`indigo-600` were. Cheap fix if wanted: `&.complete.active { @apply bg-accent border-accent; }`, or drop `active` from the class binding when the phase is complete.
- Phase 7's sweep should note the wizard's remaining `style="width: …"` / `style="flex: …"` / `[style.grid-column]` bindings are **structural only** — re-confirmed by an exhaustive sweep of all 8 files for `#hex` / `rgb(` / `rgba(` / `hsl(` / `oklch(` / `oklab(` / `color-mix(` / every `*-[…]` arbitrary-value utility family / `style=` / `[style.*]` / `ngStyle` / `ngClass`: **zero colour-bearing literals or bindings**. The only `*-[…]` brackets left are sizes and typography (`text-[0.9rem]`, `tracking-[0.06em]`, `leading-[1.4]`, `px-[0.55rem]`, `font-[inherit]`, `flex-[1_1_220px]`, `min-h-[80px]`); the only inline styles are `width`, `flex`, `font-size` and `[style.grid-column]`. The single `text-white` a naive grep finds in `mystery-create.scss` is inside the placeholder comment on line 51, not a live class.
