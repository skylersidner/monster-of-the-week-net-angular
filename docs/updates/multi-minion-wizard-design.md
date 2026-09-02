# Multi-Minion Support in the Mystery Wizard — UX / Visual Design

**Prepared by:** Rosalina (Designer)
**Status:** Accepted. All seven Open Questions resolved by Skyler (1-2 on 2026-09-01, 3-7 on 2026-09-01). Ready for implementation.
**Date:** 2026-08-31

> Filed under `docs/updates/` alongside `docs/updates/multi-minion-support.md` (Yoshi's state/data architecture plan for the same feature) and `docs/updates/standalone-creation-phase2-minions.md`. This document covers **only** the interaction and visual half: what the wizard's minion step looks like and how it behaves. The store/API half is Yoshi's doc; where this design requires something different from it, that's called out explicitly in "Divergences from the Architecture Plan."

---

## Scope Correction — What Has Shipped Since the Architecture Plan

Yoshi's `docs/updates/multi-minion-support.md` is dated 2026-08-04 and is described as "now-parked" by `docs/updates/standalone-creation-phase2-minions.md:11`. Three of its premises are stale as of the current `main` (`f872d5e`), verified by reading current source:

- **`DELETE /api/minions/{id}` now exists.** Yoshi's MM-1 listed it as a required backend gap; `.squad/decisions/inbox/bowser-minion-delete-backend.md` records it as shipped (repository → service → `MinionsController`, with FK cascade verified). MM-1 is done.
- **A shared `MinionFormComponent` now exists** at `features/minions/shared/minion-form/minion-form.ts`/`.html`, contradicting Yoshi's decision #8 ("no shared component"). It owns the 4 core fields (name / harmCapacity / minionTypeId / description) and is consumed by `minion-detail` and `minion-create`. It is *not* usable by the wizard as-is — it renders its own submit button and emits an `UpsertMinionRequest`, which is the wrong lifecycle for a batched-at-phase-transition wizard. That's a build detail, not a design one, but it means "reuse `MinionFormComponent`" is a live question Luigi will hit.
- **A complete standalone minion authoring page ships at `/monsters/:monsterId/minions/new`** (`features/minions/pages/minion-create/minion-create.html`), with all four sub-resource lists as local drafts plus a single batched create. `monster-detail.html:22` already links to it. This directly affects how much the wizard's minion step needs to do — see Open Question 2.

---

## Current State (verified by reading current source)

| Concern | Where | Today |
|---|---|---|
| Wizard minion form | `mystery-create-monster-phase.html:148-288` | Exactly one implicit minion slot: 4 core fields + 4 sub-resource panels, no list, no save action |
| "Optional" affordance | `mystery-create-monster-phase.html:149`, `mystery-create.store.ts:517`, `:466-484` | Blurb says "leave the name blank to skip"; a `minionSectionStarted`/`minionNameRequired`/`minionNameMissing` computed trio fakes conditional-required on Name, and gates `validateCurrentStep()` at `:913` |
| Dossier preview | `mystery-create-dossier.html:125-192` | One `store.minionPreview()` block, rendered at the same weight as The Monster block, as its own top-level section |
| Repeated-things pattern (twice) | `mystery-create-locations-phase.html:1-29`, `mystery-create-bystanders-phase.html:1-29` | Summary rows on top (`bg-surface-sunken border border-default rounded-md ... justify-between px-3 py-2`, name + `×`), italic empty state, then a bordered add-form card with an outline-accent `+ Add X` button. **No edit-in-place** — append and remove only |
| Minion summary card (outside the wizard) | `monster-detail.html:29-37`, `minions-list.html:16-41` | `bg-surface border border-default rounded-lg`, name link + `bg-badge-minion text-on-badge-minion` type badge + `<small>` counts line "Attacks: n · Powers: n · Armors: n · Weaknesses: n", with a right-hand `shrink-0` action cluster using the global `.action-btn` / `.action-btn--edit` / `.action-btn--delete` classes (`styles.css:266-280`) and `<app-icon name="pencil"/"trash" class="h-5 w-5" />` |
| Post-wizard mystery view | `mystery-detail.html:95-113` | **Already renders `minions()` as a list.** Confirmed — needs no change for multiplicity |
| Panel width | `mystery-create.html:5` | The form column is `w-[42%]` and scrolls; the dossier is the remaining `flex-1` |

The last row is the binding constraint on everything below: whatever the minion step becomes, it lives in a narrow, already-scrolling column whose inline sub-resource add-forms are already fighting for horizontal space (`flex-[1_1_220px]` inputs, a `flex: 0 1 160px` weapon-tag select).

---

## 1. Recommended Pattern — Roster + Single Active Composer

**One sentence:** extend the locations/bystanders pattern the wizard already uses twice — a summary list on top, an authoring form below — with an *edit* affordance on each row and an explicit *Save Minion* action on the form, so that at most one minion's four sub-resource lists are ever expanded at a time.

### 1.1 Anatomy of the step (top to bottom)

**(a) Blurb.** `store.stepBlurb()['1-1']` (`mystery-create.store.ts:517`) currently ends "Minions are optional—leave the name blank to skip this step." That sentence describes a mechanism that no longer exists under this design. Reword the tail to "Minions are optional — you can add as many as you need, or skip this step entirely." Nothing else in the blurb changes.

**(b) Minion roster.** A list of one summary card per draft, rendered *above* the composer — same position the locations/bystanders lists occupy. Card markup should be lifted from `minions-list.html:16-41` rather than invented:

- `<li class="flex items-center bg-surface border border-default rounded-lg gap-4 justify-between p-4">`
- Text block wrapped in `flex-1 min-w-0`; name + `bg-badge-minion text-on-badge-minion` type badge on a `flex flex-wrap items-baseline gap-2` line; a `<small>` counts line reading `Attacks: n · Powers: n · Armors: n · Weaknesses: n`.
- Right-hand `flex items-center shrink-0 gap-1` action cluster: an **edit** button (`action-btn action-btn--edit`, `<app-icon name="pencil" class="h-5 w-5" />`, `title="Edit minion"`) and a **remove** button (`action-btn action-btn--delete`, `<app-icon name="trash" class="h-5 w-5" />`, `title="Remove minion"`).
- The name is plain text here, not a `routerLink` — inside the wizard the draft may have no `id` yet, and navigating away mid-wizard is not an affordance we want.

Two deliberate differences from the locations/bystanders rows: these are `bg-surface` cards rather than `bg-surface-sunken` strips (a minion carries four nested lists — it's a compound object and should read as a card, not a chip), and they carry the icon-button pair rather than a bare `×`. Both differences are already the shipped vocabulary for minions specifically, on `monster-detail` and `minions-list`.

The card whose draft is currently loaded into the composer gets `border-accent bg-accent-subtle` and its pencil button is swapped for a static `Editing` label (`text-accent text-[0.72rem] font-semibold uppercase tracking-[0.04em]`), so the roster and the composer are visibly the same object.

**(c) Empty state.** `<p class="text-muted text-sm italic">No minions added yet — this step is optional.</p>`, matching `mystery-create-locations-phase.html:9` verbatim except for the trailing clause. This is where the "optional" affordance now lives.

**(d) Composer.** One authoring region containing exactly what the step contains today: the 4 core fields, then the 4 sub-resource panels, then an action footer.

- **When the roster is empty, the composer is open.** A first-time user therefore sees essentially today's step, with a Save button added — no extra click, no "where do I start" moment.
- **When the roster is non-empty and nothing is being edited, the composer is collapsed** to a single outline-accent `+ Add Another Minion` button, using the exact class string of `+ Add Location` (`mystery-create-locations-phase.html:28`).
- **Composer header:** `<div class="flex items-center justify-between mb-4">` (the pattern at `monster-detail.html:20`) with `<h4 class="text-primary text-sm font-bold m-0">` reading `Add a Minion` or `Editing “{{ name }}”` (the name span needs `truncate min-w-0`), and, in edit mode, a text-weight `Cancel` on the right.
- **Composer footer:** a right-aligned action row with `Save Minion` / `Save Changes` and, in edit mode, `Cancel`.

**Button-weight call — `Save Minion` must NOT be a filled accent button.** The wizard's `Next →` is `bg-accent ... text-on-accent` (`mystery-create.html:36`) and sits in the same 42% column, roughly one scroll-position away. Two filled accent buttons in one column is a genuine hierarchy collision — the user cannot tell which one advances the wizard. Use the outline-accent treatment every `+ Add` button in this wizard already uses (`bg-transparent border border-accent rounded-md text-accent ... hover:bg-accent-subtle transition-colors`, `mystery-create-monster-phase.html:64`), so `Next →` remains the only filled accent control on screen. `Cancel` takes the wizard's own secondary treatment (`bg-transparent border border-strong rounded-lg text-muted`, `mystery-create.html:35`).

### 1.2 Keeping four sub-resource lists legible

This is the part the brief correctly identified as the actual design problem, and the answer is structural rather than decorative: **only one minion's sub-resource panels are ever rendered.** The vertical height of the step is therefore constant in N — three minions costs three ~72px roster rows (~220px) plus the same composer the step has today. The `<small>` counts line on each roster card is the at-a-glance substitute for the collapsed panels, and it is already the shipped vocabulary for exactly this purpose on `monster-detail.html:35` and `minions-list.html:26-29`.

**Nesting treatment (recommended, low-risk to defer).** Once the four sub-resource panels sit *inside* a composer, they are one level deeper in the hierarchy than they are today, and a bordered card inside a bordered card inside a 42% column reads as mush. Recommendation: give the composer the same wrapper the locations/bystanders add-form already has (`border border-default rounded-lg mt-4 p-4`, `mystery-create-locations-phase.html:13`), and drop the four inner panels from `border border-default rounded-lg mb-4 p-3` to `bg-surface-sunken rounded-lg mb-4 p-3` — borderless, one step down the elevation ladder. On the column's `bg-surface` background (`mystery-create.html:5`) that reads as "recessed sub-list belonging to the card around it," and it holds in dark mode too, since `surface-sunken < surface` is the established elevation direction (`docs/theming/dark-theme-palette.md`).

This is a deliberate divergence between the monster step and the minion step *within the same phase*, and it's justified by hierarchy, not taste: on the monster step the panels are top-level (one monster, no wrapper), so a border is the correct weight; on the minion step they are nested one level, so they should be one step lighter. If Luigi wants to ship the smaller diff first, keeping the borders is acceptable for v1 — the pattern still works, it just looks busier.

### 1.3 The four verbs

| Action | Behaviour |
|---|---|
| **Add a minion** | Composer open (automatically when the roster is empty, or via `+ Add Another Minion`) → fill fields and sub-lists → `Save Minion` → a card appears in the roster, the composer resets and collapses. |
| **Edit an existing minion** | Pencil on its roster card → its core fields *and* all four sub-resource lists load into the composer → the card marks itself `Editing` → `Save Changes` commits back into the same roster slot. Works identically for a draft that has never been saved to the API and one loaded from an existing mystery. |
| **Start a new one while editing** | `+ Add Another Minion` is available while editing; it applies the same commit rule as `Next` (below) to whatever is open before resetting the composer. |
| **Remove a minion** | Trash on its roster card → `ConfirmDeleteModalComponent` → the card disappears. |

**On confirming removal.** This diverges from locations/bystanders, whose `×` removes instantly. The divergence is justified twice over: (i) a minion is a compound object that may take up to four sub-lists with it, so an accidental click is expensive in a way losing a location's name is not; and (ii) on a revisit, removing a previously-saved minion draft maps to a real hard `DELETE /api/minions/{id}` on Next. `.squad/decisions/inbox/luigi-hunter-playbooks-tracks-overflow-and-delete-confirm.md` records "every other destructive-delete surface in the app already goes through `ConfirmDeleteModalComponent`" as this codebase's standing convention, so confirming is the consistent choice and instant-removal is the local exception. `ConfirmDeleteModalComponent`'s existing `[items]` input (`shared/confirm-delete-modal.component.ts:12`) is the right place to list what goes with it (e.g. `["2 attacks", "1 power"]`) — it exists for exactly this and is currently passed `[]` everywhere. The **sub-resource** `×` buttons inside the composer keep today's instant behaviour unchanged. See Open Question 4.

### 1.4 What happens to an open composer when the user hits Next

One rule, stated so a user can internalise it: **an open composer is committed if it can be, and you're stopped if it can't.**

| State of the composer on `Next` (or on switching drafts) | Behaviour |
|---|---|
| Empty | Proceed. Nothing was lost. This is the zero-minion path. |
| Valid (name + type present) but not explicitly saved | **Silently commit it to the roster, then submit the phase.** |
| Started but invalid (sub-resources added, or description/type set, but no name) | Block. Mark Name touched, show the inline field error, and surface the wizard's existing error band (`mystery-create.html:30-32`) with "Finish or clear the minion you're editing before continuing." |

The middle row matters more than it looks. Today's step has *no* explicit save at all — `Next` is what commits the single minion (`mystery-create.store.ts:1027-1048`). Blocking a user who filled in one minion and pressed Next without noticing a new `Save Minion` button would be a flow regression for the single-minion case, which is the common case. Auto-committing also keeps faith with the wizard's own standing model: "submission happens at phase transitions" (`.squad/decisions.md`, 2026-07-21).

The third row is the one that requires disagreeing with the architecture plan — see below.

### 1.5 Alternatives considered and rejected

**Accordion list — every minion is a collapsible card, all in one list, expand-to-edit in place (rejected).** This is the most obvious answer and it's the one I'd expect a reviewer to ask about, so: the reason it loses is not the accordion mechanism, it's that it forces an authoring form to render *inside a list row*. At 42% column width the sub-resource add-forms are already wrapping (`flex-[1_1_220px]` name inputs, a `flex: 0 1 160px` weapon-tag select, `flex-[1_1_100%]` textareas); nesting them one further level inside an expanded list item costs another ~24-32px of horizontal padding and pushes the attack row from two-up to fully stacked. It also makes the collapsed and expanded states of the same row wildly different heights (~72px vs ~900px), which means expanding minion #3 scroll-jumps the panel and hides minions #1-2 above the fold — the exact "swamping" problem multiplicity was supposed to fix. And it has no precedent here: the wizard's two existing repeated-things surfaces both separate the list from the form, and `hunter-form.html:310-331`'s repeatable journal entries only inline their fields because each entry is 1-3 plain text inputs. The roster+composer pattern gets the same benefit (one thing expanded at a time) while keeping the authoring form at full column width and at a stable screen position.

**Modal-per-minion (rejected).** A modal would give the sub-resource forms real width, and it cleanly separates "the roster" from "authoring one minion." But it breaks the wizard's core promise: the dossier panel on the right is a live preview that updates as you type (`mystery-create-dossier.html`, `store.minionPreview()`), and a modal covers or disconnects from it. The wizard has no modal-over-wizard precedent, and the app's only modal is `ConfirmDeleteModalComponent`, a confirm dialog. Rejected.

**Tabs, one per minion (rejected).** Tab strips don't survive N growing (three "Cultist" tabs truncate to indistinguishable stubs), there's no tab component in this codebase, and "add a tab" is a weak affordance for "add an entity."

**Master-detail two-pane inside the step (rejected).** There is no room. The step already lives in a 42% column with a preview pane to its right; splitting it again would give the authoring form ~20% of the viewport.

---

## 2. Dossier Preview

The dossier's job is "what have I built so far," with a live bias toward what I'm typing right now. With N minions it must not out-weigh the monster it serves.

**Recommendation:**

1. **Keep one `Minions` section**, in its current position — a sibling of `The Monster`, not nested inside it, with the same section chrome and `<app-mystery-section-icon kind="minions" />` header. Grounding for "sibling, not nested": `mystery-detail.html:75-113` already renders Monsters and Minions as sibling cards, and the wizard's own step model already gives minions their own icon and step (`mystery-create.store.ts:444-446`). Nesting here would diverge from both.
2. **Render one compact entry per minion:** the name line, the `bg-badge-minion` type badge, and a single `<small>`-weight counts line — the same summary vocabulary as the roster card. Not the full attacks/powers/weaknesses/armor `<ul>` treatment.
3. **Expand exactly one:** the minion currently loaded in the composer renders its four sub-lists in full, using today's markup unchanged. Everything else stays collapsed. This preserves the live-preview character (you can watch the minion you're editing fill in) while three minions cost three short entries instead of three full blocks.
4. Section visibility condition changes from `store.minionPreview().name` to "the roster is non-empty **or** the open composer has a name," so the section doesn't vanish the moment a saved minion is committed and the composer resets.
5. Don't add count chrome to the section header — the entries themselves show the count, and no other dossier section carries one.

**Bug to fix in the same change.** `mystery-create-dossier.html:165` iterates `store.minionWeaknesses()` — the raw live signal — inside a block that is otherwise reading `store.minionPreview()`. It's harmless today because they're the same array. Under a `minionDrafts` model it becomes a visible cross-minion leak: a collapsed minion #2 would render minion #1's weaknesses. It must be repointed to the per-draft weaknesses when this work lands.

---

## 3. Post-Wizard Display

| Surface | Verdict |
|---|---|
| `mystery-detail.html:95-113` | **Confirmed: already renders all minions as a list.** No change required for multiplicity. One consistency gap worth a follow-up: it lists minions flat with no indication of which monster owns each, while the sibling card lists monsters (`:86`). With one monster that reads fine; with two monsters × three minions each it's ambiguous. `MinionListItemResponse` already carries `monsterName` and `minions-list.html:23` already renders exactly the line needed ("Belongs to: …"). Cheap, existing data, existing markup. Not blocking. |
| `monster-detail.html:19-41` | Already has the roster + `+ Add Minion` and is the source of the card vocabulary this design imports. **Known asymmetry (left open by decision):** there is no remove affordance on those minion cards (confirmed — `monster-detail.ts` has no delete-minion path), so you can add a minion from this page but not remove one, while `minions-list.html:32` can. **Skyler declined this (Open Question 6, resolved 2026-09-01) — do NOT add a remove affordance here.** The asymmetry stays open by decision, not oversight; removal remains available from the wizard composer and from `minions-list`. |
| `minion-detail`, `minions-list`, `minion-create` | No change. |

---

## 4. Edge Cases (design decisions, not code decisions)

**Zero minions.** Roster shows the italic empty state; the composer is open, so the step looks essentially like today's; `Next` is never blocked. Optionality is communicated in two places instead of one: the blurb's closing sentence and the empty-state line. The old field-level affordance (a Name field whose required-ness toggles) disappears entirely, which is a net gain — it was never discoverable.

**Exactly one minion — does the UI regress gracefully?** Mostly. Before saving, the step is today's step. After saving, the user sees one roster card and a collapsed `+ Add Another Minion` button, which is *more* chrome than today for the most common case, and editing that minion now costs one click. This is the one real regression this design carries, and it's worth naming rather than hiding: **the single-minion user pays exactly one extra click (`Save Minion`)** for the feature. I considered keeping the composer open in edit mode on the just-saved minion to avoid the collapse, and rejected it: it makes "did that save?" ambiguous and re-creates the dirty-state problem the explicit Save exists to solve. A clear post-save state (the new card animating in, composer reset) is the better trade.

**Many minions (6+).** Roster rows are ~72px, so six is ~430px of scroll above the composer, inside a panel that already scrolls. Acceptable. **Do not** give the roster its own `max-h-*` + `overflow-y-auto` — a nested scroll region inside an already-scrolling 42% column is a worse experience than a longer page, and `min-w-0`/overflow traps in this codebase have already bitten once (`.squad/decisions/inbox/luigi-hunter-playbooks-tracks-overflow-and-delete-confirm.md`).

**Long names.** Solved by copying `minions-list.html:16-41` faithfully: `flex-1 min-w-0` on the text block, `shrink-0` on the action cluster, `flex-wrap items-baseline` on the name+badge line. The composer header's `Editing “…”` needs `truncate` and a `min-w-0` parent or it will push the Cancel button off-column. In the dossier, names wrap naturally at `text-[0.9rem] leading-[1.5]` — no change needed.

**Partially-filled composer on Next.** Covered by §1.4's single rule.

**Duplicate minion names.** Nothing in the stack enforces uniqueness, and two roster cards both reading "Cultist" are genuinely ambiguous. I recommend *not* inventing a uniqueness rule here — `monster-detail`'s existing list has the same property today, and the counts line gives some differentiation. Noted, not solved.

---

## Divergences from the Architecture Plan

Yoshi's `minionDrafts` + single `editingDraftIndex` + reuse-the-existing-form-as-the-active-draft model is exactly the state shape this design needs — the roster is `minionDrafts()`, the composer is the existing `minionForm` + four signals, and `editingDraftIndex() === null` is "adding" while `=== i` is "editing." No conflict there. Two specific points differ:

1. **Decision #10 goes too far.** Yoshi recommends deleting `minionSectionStarted` / `minionNameRequired` / `minionNameMissing` as dead code and dropping the `phase === 1 && step === 1` branch from `validateCurrentStep()` (`mystery-create.store.ts:913`) entirely, on the grounding that "an empty `minionDrafts()` is trivially valid." That's right for the roster but wrong for the composer. Under §1.4, `Next` still needs to distinguish *empty* composer (proceed) from *started-but-nameless* composer (block) — otherwise a user who typed a description and added two attacks, then pressed Next, silently loses all of it. `minionNameRequired()` genuinely does die (Name gets an unconditional `*`, matching Monster Name at `mystery-create-monster-phase.html:4`), but `minionSectionStarted()`'s "has the user put anything in here" detection survives, repurposed from "is Name required?" to "is there content worth blocking on?". Concretely: keep a `phase === 1 && step === 1` branch in `validateCurrentStep()`, just with different semantics.
2. **The "silent data loss on draft switch" risk Yoshi flagged for Luigi/Rosalina is answered by §1.4, not by a discard-confirmation modal.** A confirm-on-switch would fire on the most common interaction in the step and train people to dismiss it. Commit-if-valid / block-if-not needs no modal at all, and the only case that could still lose work — an invalid composer — is the case we block on.

Everything else in Yoshi's plan (per-draft sub-resource ID baselines, the diff/delete/update/create pass in `submitPhase1`, `forkJoin` over all minions in `loadEditData`) is orthogonal to this design and stands.

---

## Open Questions for Skyler

1. ~~**"more than one Minion to an associated monster (and mystery)" — which does the parenthetical mean?**~~ **RESOLVED 2026-09-01 — Skyler confirms: N minions under the wizard's one monster.** The parenthetical was not asking for minions spanning several monsters; minions reach the mystery through their monster, as the FK requires. This design's assumption stands unchanged.
2. ~~**Does the wizard's minion step still need full sub-resource authoring?**~~ **RESOLVED 2026-09-01 — Skyler confirms: keep them inline.** The wizard's minion step retains all four sub-resource panels; the standalone minion page at `/monsters/:monsterId/minions/new` is an additional path, not a replacement for authoring depth in the wizard. The composer pattern in §1 absorbs the vertical cost.
3. ~~**Should the minion step tracker dot ever light up?**~~ **RESOLVED — yes.** If any minion is present the dot lights up: `phaseStepComplete()[1][1]` becomes `minionDrafts().length > 0`, replacing the hardcoded `false` at `mystery-create.store.ts:409`. The step stays optional (an empty roster still advances); the dot reports "you put something here," not "this was required."
4. ~~**Confirm-on-remove for a minion draft: always, or conditionally?**~~ **RESOLVED — always confirm.** Unconditional, as SS1.3 recommends, via the existing `ConfirmDeleteModalComponent` with its `[items]` input listing the sub-resources that go with it. The deliberate divergence from the bare `x` on locations/bystanders stands. Sub-resource `x` buttons inside the composer keep todays instant behaviour.
5. ~~**`mystery-detail` flat minion list -- add a "Belongs to {monster}" line?**~~ **RESOLVED — yes, add it.** Each minion entry on `mystery-detail` names its parent monster.
6. ~~**`monster-detail` gaining a Remove Minion action?**~~ **RESOLVED — no, out of scope.** Skyler does not want a remove-minion button on `monster-detail`. Note the consequence, recorded deliberately rather than silently: the add-without-remove asymmetry described in the Touchpoints table stays open on that page. Removal remains available from the wizard composer and from `minions-list`.
7. ~~**Should the roster be reorderable?**~~ **RESOLVED — no.** No ordering field, no reorder affordance. The roster renders in creation order.
