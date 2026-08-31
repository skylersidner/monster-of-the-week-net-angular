### 2026-08-30: Playbook Admin — Tracks/Ratings/Gear Number-Input Overflow Fix + Delete Confirmation Added

**By:** Luigi (Frontend Developer)

**What:** Two fixes to `src/web/monster-of-the-week-web/src/app/pages/data-admin/components/playbook-admin/`:

1. `playbook-form/playbook-form.html` — added `w-full min-w-0` to every `<input type="number">` living inside a fixed-width (`w-[...]`) `<label>`: the 5 Tracks fields, the 5 Ratings fields (`charm`/`cool`/`sharp`/`tough`/`weird`), and Gear's `pickCount`. Also added `min="0"` to the 5 Track inputs whose `FormControl` already carries `Validators.min(0)`, matching the existing `monster-form.html`/`minion-form.html` convention of pairing that validator with the HTML attribute.
2. `playbook-admin.ts`/`.html` — the Playbooks list's Delete button now opens the shared `ConfirmDeleteModalComponent` (`pendingDelete`/`requestDelete`/`cancelDelete`/`confirmDelete`) instead of deleting on click, matching every other list page in the app (monsters, minions, locations, bystanders, mysteries).

**Why:**

1. `<label class="grid ... w-[Xrem]">` wrapping a bare `<input type="number">` is a CSS Grid item whose default `min-width: auto` locks it to its UA-intrinsic content width (~170-220px) regardless of the label's own fixed width — so it overflows the label and paints over the next field once the label is narrower than that intrinsic minimum. This is the same overflow mechanism `min-w-0` already guards against for flex items elsewhere in this codebase (`page-layout.html`, `custom-select.component.html`, all five `*-list.html` pages); this fix is the grid-item form of the same fix, applied everywhere in this form the shape recurs (not just the one section Skyler reported).
2. The Playbooks list's Delete button deleted instantly with zero confirmation — a real regression from this codebase's own established pattern, not a new judgment call. Every other destructive-delete surface in the app already goes through `ConfirmDeleteModalComponent`; this component simply hadn't wired it up yet.

**Left alone (described, not fixed — judgment call for Skyler):** Only the top-level `name` field in `playbook-form.html` has visible inline validation messaging (`shouldShowNameError()`). Every other required field — the 5 Track counts and every FormArray child's required control (move name, gear category label, look option text, improvement text) — silently blocks `submit()` with no visible explanation when invalid. Fixing this is a broad, wording/scope-heavy change (which fields get messages, what they say, whether to adopt the `*`-in-label convention `monster-form.html`/`minion-form.html` use) rather than a mechanical fix, so it's flagged rather than done unilaterally.
