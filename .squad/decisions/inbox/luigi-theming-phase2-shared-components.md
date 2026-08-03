### 2026-08-02: Theming Phase 2 — Judgment Calls and a Recurring Token Gap (Neutral/Secondary Surface)
**By:** Luigi (Frontend Developer)

**What:** Phase 2 (`confirm-delete-modal`, `custom-select`, `weapon-tag-select`) is implemented and verified. Four items need review before Phase 3, three of them judgment calls I made because no token covers the case, and one a genuine catalogue gap that will recur in Phases 3, 4 and 5.

---

#### 1. GAP (needs a decision, will recur): no neutral/secondary-surface token

The Catalogue has no token for "a neutral, non-accent, non-danger interactive fill or hover." The confirm-delete modal's Cancel button (`bg-gray-100 text-gray-700 hover:bg-gray-200`) is the first consumer, but the same literal appears in at least five more places already scheduled for later phases:

- `minion-detail.scss` — `.action-btn:hover:not(:disabled) { @apply bg-gray-100; }` (Phase 3)
- `monsters-list.scss`, `monster-detail.scss` — same rule (Phases 4 / 5)
- `locations-list.html`, `bystanders-list.html` — `hover:bg-gray-100` on the row action buttons (Phase 4)
- `search-results.html` — `hover:bg-gray-100` on both pager buttons (Phase 4)

**What I did for now:** mapped the Cancel button to `bg-surface-sunken text-secondary hover:bg-accent-subtle`. `hover:bg-accent-subtle` follows the precedent Phase 1 already set (`hover:bg-indigo-50` → `hover:bg-accent-subtle` on the user-menu links), and it moves *toward* the light in dark mode, matching Rosalina's Philosophy #4. It is legible and theme-correct in both themes.

**Why it still needs review:** it is not free.
- Light-mode fill goes `gray-100` (`#f3f4f6`) → `slate-50` (`#f8fafc`) — the button gets slightly paler against the white modal panel, so its affordance is marginally weaker than today.
- Light-mode hover goes `gray-200` → `indigo-50`, a **hue** change (neutral → faintly indigo) on a hover state.

**Recommendation for Rosalina/Yoshi:** consider a `--color-surface-hover` (or `--color-neutral-subtle`) pair before Phase 3, since ~6 more sites hit this exact shape. If one is added, the Cancel button and all the `bg-gray-100` hovers repoint to it in one motion. If not, the mapping above becomes the standing convention by default and should be stated as such.

#### 2. Judgment call: confirm-delete scrim `bg-black/45` → `bg-slate-950/55`

Rosalina's palette (Modals & Overlays) recommends standardizing **both** modal scrims on `bg-slate-950/55`, and `theming-plan.md`'s Phase 1 already describes the API-modal scrim as "matching the confirm-delete modal's own scrim" — which was not actually true, because this modal was still on `bg-black/45`. I completed the standardization so the plan's own statement is now true. It is a deliberate, small, theme-invariant light-mode change (pure black at 45% → slate-950 at 55%: slightly darker, slightly blue-tinted). Revert to `bg-black/45` if the darker scrim isn't wanted — nothing else depends on it.

#### 3. Judgment call: modal heading `text-blue-900` → `text-primary`

No blue token exists, and the heading's role is unambiguously "primary/heading text." Light mode shifts `blue-900` (`#1e3a8a`, navy) → `slate-950` (`#020617`, near-black). Consistent with what Phase 3 will have to do anyway: `text-blue-900` is used identically as the page title on `bystander-detail.html`, `location-detail.html` and `minion-detail.html`. Flagging in case that navy was an intentional brand accent on titles rather than an incidental leftover — if it was, it needs its own token, and Phase 3 should hold.

#### 4. Judgment call: selected-option sub-label loses its lighter accent shade

`custom-select.component.scss` had `.is-selected .custom-select__option-sublabel { @apply text-indigo-500; }` — one step lighter than the selected label's `text-indigo-700`, so the sub-label read as secondary. There is no "lighter accent" token (`--color-accent-hover` is *darker* in light mode), so both now resolve to `text-accent`. The sub-label stays differentiated by font-weight (`normal` vs `semibold`) and size (`0.78rem`), just not by shade. Acceptable as-is in my view; a `--color-accent-muted` would restore it if anyone cares.

#### 5. Minor, already applied and noted in-file

- `custom-select`'s search input had **no** color class at all and inherited the UA default black through Tailwind preflight's `color: inherit`. Invisible in light mode; black-on-near-black in dark. Added `text-primary` to its `@apply` line (an addition, not a re-point) so the shared component is self-sufficient, per Phase 2's stated goal.
- `.custom-select__search`'s divider went `border-slate-100` → `border-default` (`slate-200`) — one step darker in light mode; no `slate-100`-weight border token exists.
- Focus states went `border-indigo-500` → `border-accent` (`indigo-600`) and `rgba(99,102,241,.18)`/`.16` → `ring-focus` (`indigo-500` @ 20%) — the same three sanctioned shade shifts already accepted for `header-search` in Phase 1.
- Dead pre-existing class, unrelated to theming: `custom-select.component.html` applies `[class.multiple-select]` but nothing anywhere styles `.multiple-select`. Harmless; flagging for whoever next touches that component.

#### 6. Not a gap, confirmed: no spec changes were needed

Phase 0's disabling sweep was accurate for this phase. `custom-select.component.spec.ts` is the only spec for these three components and asserts structural classes (`.custom-select__trigger`, `.custom-select__option-sublabel`) and text only — never a color utility. `confirm-delete-modal` and `weapon-tag-select` have no specs at all. No new color-literal assertion was found that Phase 0 missed.
