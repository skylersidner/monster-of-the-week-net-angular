# Hunter Form — Unticking a Move Drops Its Bespoke Section State

**By:** Luigi (Frontend Developer)
**Date:** 2026-09-11

## What

`HunterFormComponent.toggleMove(moveId)` now clears all form state for a move's own `bespokeSections` when the move transitions from ticked to unticked: any `bespokeInstances` filed under those sections are removed, and every `bespokePicks`/`bespokeAnswers`/`bespokeFreeText` entry keyed by those section ids or by the removed instances' own keys goes with them. Re-ticking the move starts empty — there is no restore. Required moves are unaffected (they never call `toggleMove`). No confirm dialog was added.

Extracted a small shared helper, `clearBespokeSections(sections)`, used only by `toggleMove`. Generalized the existing `omit(map, key)` to `omit(map, keys: Iterable<string>)` so both `removeInstance` (single key) and the new helper (many keys) share one implementation. Left `dropSelectionsOutside`'s playbook-change prune untouched — it filters the inverse direction (keep valid) and reads fine as its own thing.

## Why

`HunterService.ValidateBespoke` was tightened server-side (2026-09-11, Bowser/Toad, per Skyler) to refuse a bespoke entry or answer under a section whose owning move the hunter hasn't taken. Filled-in answers under an unticked move were already refused before that fix; the new part is that *entries* (repeatable-section instances, e.g. the Searcher's Network) are refused too. Frontend never dropped either on untick, so a hunter who added Network entries, unticked Network, and saved got a refusal naming a move they'd already unticked in the UI. Skyler chose the frontend-only fix over a confirm dialog or a server relaxation: "Unticking means those entries are gone, the same as removing them."

## Not done, flagged

No confirm-before-untick dialog — not asked for, and Skyler's chosen option text treats the loss as equivalent to using the existing (also confirm-less) remove-entry control. Worth a second look only if a user complains about a move being unticked by accident.
