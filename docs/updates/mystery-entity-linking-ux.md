# Editing, Attaching and Removing Entities in the Mystery Wizard — UX / Visual Design

**Prepared by:** Rosalina (Designer)
**Status:** **Settled — Phases 3 and 4 shipped; Phase 5 rulings in §16 (a monster is no longer required) and §17 (attaching a monster holds the roster until its subtree lands), with §15's two Phase 4 fixes still outstanding for Luigi.** Every question in §12 is answered; **nothing in this document is waiting on Skyler.** Phase 3 (Luigi) implemented the modal's new input surface (§7.7), the `Escape` fix (§8.7) and accessibility items 1, 4, 5 and 7; two claims of mine were wrong in implementation and are corrected in place, with the reasoning, in §7.1 and §7.6. One new requirement (§8.6, focus after the composer collapses) was identified during that phase and is scoped to the roster replication. Each decision is folded into the section it affects and left in §12 struck through, so cross-references from Yoshi's doc still resolve. OQ9 is Luigi's call at implementation time and blocks nothing. OQ10 is deliberately deferred and has a durable home in §12.1, per Skyler's instruction to record it for after the final phase.
**Date:** 2026-09-19 · **Reconciled against Yoshi's `mystery-entity-linking.md` rev 3, then against Skyler's answers to Yoshi's seven questions, then against his answers to the six remaining questions here** — see the dated notes in §2.2, §2.3, §7.1, §7.2, §8.7, §9.3, §9.5, §10.1 and §12. **§9.5 (added 2026-09-19, after Phase 2 landed) rules on the two partial-failure strings Luigi introduced and flagged; it carries two behaviour requirements for him, not only copy.**

> Filed under `docs/updates/` alongside `docs/updates/mystery-entity-linking.md` (Yoshi's architecture proposal for the same feature) and `docs/updates/multi-minion-wizard-design.md`, whose roster-plus-composer pattern this generalises to all four entity types. This document covers **only** the interaction and visual half. Where it requires something Yoshi's doc does not currently allow, that is called out explicitly in §10 rather than left for Luigi to discover.

---

## 0. The ask, and what it changed

Skyler's answers moved three things since Yoshi's draft:

1. **"I want any entity to be editable in the wizard."** This reverses Yoshi's Open Question 6 (he recommended attached rows be read-only) and, with it, the absolute form of his safety property "attaching must never mutate the attached object" (§2.4, §5.2). See §10.1 — this needs a state-model change, not just a template change.
2. **"Now a user has to select which of the associated entities they want to show up in the edit form."** That selection mechanism is the core of this document. Short answer: **the roster row is the selector, the pencil is the act of selecting, and exactly one row is selected at a time.**
3. **Removal gets a confirmation modal offering Detach (conditionally) and Delete (always).** §7.
4. **"No need to warn at all"** about cross-mystery edits (his answer to Yoshi's OQ4). So: no advisory copy on the edit form, no interstitial, no per-save confirmation. §9 says what that leaves.

Plus the two things the brief adds: a **monster roster** in the wizard (Yoshi's M3), and a **monster picker inside the wizard's minion composer**, mirroring `minion-create.html:19-29`.

---

## 1. Current state (verified by reading current source, not docs)

| Concern | Where | Today |
|---|---|---|
| Locations / Bystanders phase | `mystery-create-locations-phase.html:1-29`, `mystery-create-bystanders-phase.html:1-29` | `bg-surface-sunken border border-default rounded-md … px-3 py-2` strips, name + bare `×`; italic empty state; a `border border-default rounded-lg p-4` add-form card with an outline-accent `+ Add Location`. **No edit affordance. `×` removes instantly, no confirm.** |
| Minions phase (step 1) | `mystery-create-monster-phase.html:148-372` | **Already roster + composer, already shipped.** `<ul class="grid gap-2 list-none m-0 mb-3 p-0">`, cards `flex items-center border rounded-lg gap-4 justify-between p-4` (`bg-surface border-default`, or `bg-accent-subtle border-accent` when loaded), name + `bg-badge-minion` badge, `<small>` counts line, `shrink-0` `action-btn--edit`/`--delete` cluster, `Editing` micro-label in place of the pencil, composer header `Add a Minion` / `Editing “…”`, footer `Save Minion` / `Save Changes` + `Cancel`, `ConfirmDeleteModalComponent` on remove. |
| Monster phase (step 0) | `mystery-create-monster-phase.html:1-146` | Exactly one implicit monster. Five core fields at top level, then four `border border-default rounded-lg p-3` sub-panels. No list, no save action, no roster. |
| Store draft shapes | `mystery-create.store.ts:62-109` | `LocationDraft`/`BystanderDraft` are flat `{ id, name, description, typeId }`. `MinionDraft` additionally carries four collections + four `existing*Ids` baselines. **None carries `mysteryIds`, an origin, or a stable client key.** |
| Composer state | `mystery-create.store.ts` | `minionDrafts`, `editingDraftKey`, `composerOpen` (`:361-368`, which documents why open-ness is not derivable from the editing key). **Updated 2026-09-20:** this row used to cite a `composer: { open, editingDraftIndex }` block on `MysteryCreateDraftState`; that interface has since been deleted outright, and the key is now a stable `localKey` rather than an index (§10.2). |
| Confirm modal | `shared/confirm-delete-modal.component.*` | `role="dialog" aria-modal="true" aria-labelledby="modal-title"`, exactly **two** buttons (neutral Cancel, `bg-danger` confirm). Inputs already extended three times: `verb`, `confirmLabel`, `permanenceNote`, `items`. **No focus trap, no initial focus, no Escape handler, no focus restore.** |
| Monster picker precedent | `minion-create.html:14-30` | `isMonsterLocked()` → a prose line "Creating a minion for **X**"; otherwise a labelled `<app-custom-select [formControl]="monsterControl">` with `A minion must belong to a monster.` beneath. **Both halves of this are directly reusable.** |
| Mystery picker precedent | `location-create.html:14-21` + two twins | Single-select `<app-custom-select>` labelled "Attach to Mystery (optional)", `max-w-md`, sitting **outside and above** `<app-location-form>` (which is `max-w-[30rem]`). Two near-equal column widths stacked with one submit button between them — the layout already reads as two forms. |
| Multi-pick idiom | `weapon-tag-select.component.html` | Chips above a `[multiple][searchable]` `app-custom-select`. The template for `MysterySelectComponent`. |
| Domain badge legend | `search-results.ts:81-85` | `Mystery → bg-badge-mystery`, `Monster → bg-badge-monster`, `Minion → bg-badge-minion`, `Location → bg-badge-location`, `Bystander → bg-badge-bystander`. Shared badge class string: `rounded-full text-[0.72rem] font-semibold tracking-[0.02em] px-[0.55rem] py-[0.15rem] whitespace-nowrap`. |
| Column width | `wizard-layout.html:6` | `w-full md:w-[42%]`, scrolling. Below `md` the aside is hidden. Still the binding layout constraint. |
| House motion | `wizard-layout.scss` | One keyframe, `fadeSlideIn 0.3s ease`, scoped under `.wizard-layout`, with a `prefers-reduced-motion` guard. The only animation in the wizard. |
| House focus move | `wizard-layout.ts:47-60` | `afterNextRender({ write })` → scroll column to top, `heading.focus({ preventScroll: true })` on a `tabindex="-1"` heading. The shipped focus-management idiom. |

**The single most useful finding: three quarters of this design already ships.** The minion roster is the pattern; the work is generalising it to the other three, adding one attach control, and extending one modal. That is a much smaller change than the brief implies, and it is the reason a consistent pattern is realistic.

---

## 2. The recommended pattern — one section anatomy, four instances

**One sentence:** every entity phase becomes the shipped minion shape — **a roster of summary cards above a single active composer** — with a compact "add an existing one" strip between them; the pencil on a roster card pulls that entity into the composer, and the composer's header, its footer verb, and the source card's own highlight all say which entity is loaded.

### 2.1 Anatomy, top to bottom

```
┌─ roster ─────────────────────────────────────────────┐
│  [card]  Sheriff Dalton   (Witness: …)      ✎  🗑     │   ← bg-surface / border-default
│  [card]  Marla Quinn      (Victim: …)   EDITING  🗑   │   ← bg-accent-subtle / border-accent
└──────────────────────────────────────────────────────┘
   (empty state: italic muted "No bystanders added yet.")

┌─ attach strip ───────────────────────────────────────┐
│  Add an existing bystander   [ Search your … ▾ ]     │   ← bg-surface-sunken / border-default / rounded-md
└──────────────────────────────────────────────────────┘

┌─ composer ───────────────────────────────────────────┐
│  Editing “Marla Quinn”                               │
│  … fields …                                          │
│                              [ Cancel ] [Save Changes]│
└──────────────────────────────────────────────────────┘
   (or, collapsed:  [ + Add Another Bystander ] )

<app-confirm-delete-modal …>
```

The order matters and is not arbitrary: **roster → attach → author.** The roster is the state of the mystery, so it reads first. The attach strip is a roster-population control, so it sits with the roster and takes the roster's own lighter chrome. The composer is the heaviest block and goes last, where growing it doesn't push the roster off-screen.

### 2.2 The roster card

Lift `mystery-create-monster-phase.html:151-189` verbatim; substitute the entity noun and badge token. Nothing new:

- `<li class="flex items-center border rounded-lg gap-4 justify-between p-4">` with `[class.bg-surface]`/`[class.border-default]` when not loaded and `[class.bg-accent-subtle]`/`[class.border-accent]` when it is.
- Text block `flex-1 min-w-0`; name + type badge on `flex flex-wrap items-baseline gap-2 mb-1`; `<small class="text-muted">` secondary line.
- Action cluster `flex items-center shrink-0 gap-1`: pencil (`action-btn action-btn--edit`, `<app-icon name="pencil" class="h-5 w-5" />`) and trash (`action-btn action-btn--delete`, `<app-icon name="trash" class="h-5 w-5" />`).
- When loaded, the pencil is replaced by a static `Editing` label, `text-accent text-[0.72rem] font-semibold uppercase tracking-[0.04em]`.
- **Name is plain text, never a `routerLink`.** A draft may have no `id`, and navigating out of a half-built wizard is not an affordance we want. This is already the rule recorded for minions and it now extends to attached entities too, even though they *do* have IDs.

This is the visual answer to "select which entity shows up in the edit form": the loaded card is tinted, bordered accent, and labelled `Editing`, while the composer heading repeats its name. Two ends of the same object, visibly bonded. Note that the tint is **not** the only signal — the literal word `Editing` carries it for anyone who can't use the colour (WCAG 1.4.1). Keep both.

**Locations and Bystanders are being upgraded from a strip to a card.** Their current `bg-surface-sunken … px-3 py-2` strip has no room for two icon buttons plus a badge plus a secondary line. Use the card. The cost is vertical height (~44px → ~76px per row); the benefit is that all four phases are one component shape, which is exactly the consistency being asked for. **Settled 2026-09-19 (OQ3): "Roster rows can grow."**

**The card carries no sharing or origin marker. Settled 2026-09-19 (OQ5): "No, don't display on the roster card."** So an attached entity, an authored one, and one used by six other mysteries all render identically. That is deliberate and consistent with the no-warnings position of §9.4: origin no longer changes what the user can do, and the one moment sharing genuinely matters — removal — is where the modal states it (§7.1). Nothing in the roster needs to anticipate that. See §11 for the version of this that was rejected.

### 2.3 The composer, and how it says what mode it is in

Three reinforcing signals, all already shipped for minions:

| Signal | New mode | Edit mode |
|---|---|---|
| Composer header `<h4 class="text-primary text-sm font-bold m-0 min-w-0">` | `Add a Location` | `Editing “<span class="block truncate">Ferris Mill</span>”` |
| Footer primary | `Save Location` | `Save Changes` |
| Footer secondary | *(absent)* | `Cancel` |
| Source roster card | *(none loaded)* | `bg-accent-subtle border-accent` + `Editing` label |

**Button weight is a hard constraint, not a preference.** `Next →` (`mystery-create.html:33`) is the only filled `bg-accent` control in the 42% column and must stay that way. `Save …` takes the outline-accent treatment (`bg-transparent border border-accent rounded-md text-accent … hover:bg-accent-subtle transition-colors`); `Cancel` takes the wizard's secondary treatment (`bg-transparent border border-strong rounded-lg text-muted …`). Both class strings already exist in this file.

**Composer open/closed rule** (unchanged from the shipped minion behaviour): open when the roster is empty, so a first-time user sees essentially today's step; collapsed to an outline-accent `+ Add Another Location` once the roster has something in it; reopened by that button or by any pencil.

> **Settled 2026-09-19 (OQ2): "Yes, collapse after save."** Applies to all four entities with no exception — Locations and Bystanders collapse exactly as minions do today. The cost is real and is being accepted knowingly rather than overlooked: adding four locations in a row now costs four extra clicks it didn't before. Consistency was judged worth it. If that ever grates in practice, the exception is a one-line change (`composerOpen.set(true)` instead of `…set(drafts.length === 0)` for the two flat entities) and nothing else in this design depends on it.

**Commit rule on `Next`, and on switching rows** — carry `commitComposerIfValid()` (`mystery-create.store.ts:1003`) across to all four, unchanged: *an open composer is committed if it can be, and you're stopped if it can't.* Empty → proceed. Valid but unsaved → silently commit, then submit the phase. Started but invalid → block, mark touched, and set the wizard error band to the entity's own variant of `COMPOSER_BLOCKED_MESSAGE` ("Finish or clear the location you're editing before continuing."). This is the rule that stops "I typed a location and pressed Next and it vanished," and it is the rule that makes the roster safe to click around in.

### 2.4 The six verbs, and what each does

| Verb | Interaction | Result |
|---|---|---|
| **Author new** | Composer (auto-open when empty, or `+ Add Another X`) → fill → `Save X` | Card appended to roster; composer resets and collapses. Draft is `authored`, `id: null`. |
| **Attach existing** | Attach strip → pick from the searchable select | Card appended to roster immediately, no second click. Draft is `attached`, `id` set, `edited: false`. Select resets to placeholder; the option disappears from the list. |
| **Re-edit** | Pencil on any card — authored or attached, saved or not | Its fields (and, for monsters/minions, its four sub-lists) load into the composer; the card marks itself `Editing`; focus moves to the composer heading. `Save Changes` writes back into the same roster slot. An `attached` draft flips to `edited: true` the first time its committed values differ from what was attached. |
| **Cancel an edit** | `Cancel` in the composer footer | Composer contents discarded; roster untouched; the card drops its `Editing` state. No confirmation (this is the one reversible-by-doing-nothing action in the step). |
| **Remove** | Trash on any card → confirmation modal (§7) | Card disappears; the chosen disposition (`detach` or `delete`) is recorded on the draft and executed at the next phase submit, not immediately. |
| **Advance** | `Next →` | Commit rule above, then the phase diff. |

### 2.5 Where the per-entity differences live — and they are all in one column of one table

| | **Monster** | **Minion** | **Location** | **Bystander** |
|---|---|---|---|---|
| Phase / step | 1 · 0 | 1 · 1 | 2 | 3 |
| Roster badge token | `bg-badge-monster` (type) | `bg-badge-minion` (type) | `bg-badge-location` | `bg-badge-bystander` |
| Secondary `<small>` line | `Attacks: n · Powers: n · Armors: n · Weaknesses: n · Minions: n` | `Belongs to {monster} · Attacks: n · …` | truncated description, or `—` | truncated description, or `—` |
| Composer core fields | name, description, harm, type, **archetype** | name, description, harm, type | name, description, type | name, description, type |
| Composer sub-panels | 4, `bg-surface-sunken rounded-lg p-3` | 4, same | none | none |
| Extra composer control | none | **Monster picker** (§6) | none | none |
| Attach source | `monsterService.getAll()` | **n/a — minions have no mystery link and must not gain one** | `locationService.getAll()` | `bystanderService.getAll()` |
| Removal modal | Detach / Delete, `[items]` lists its minions and sub-resources | **Delete only** (no membership exists) | Detach / Delete | Detach / Delete |

Everything outside that table is identical markup with a noun substituted. That is the "relatively consistent pattern in the code" Skyler is hoping for, and the honest framing for Luigi is: **this should be one roster-card partial and one composer-shell shape used four times, not four hand-rolled phases.** Whether that becomes literal shared Angular components or four copies of one agreed template is Luigi's call — see OQ9.

Two notes on the table:

- **The minion row is the only one with no attach.** Minions reach a mystery only through their monster (`Minion.MonsterId`), so the minion phase gets the roster, the composer, the pencil and the confirm modal, but **no attach strip**. Say so in the blurb rather than leaving an absence: append to `stepBlurb()['1-1']` — "Minions belong to a monster, so they come and go with it."
- **The monster composer's sub-panels change chrome.** Today they are `border border-default rounded-lg p-3` at top level. Once they sit inside a composer card they are nested one level, so they drop to `bg-surface-sunken rounded-lg p-3` — exactly the step already taken for the minion composer's four panels, and correct in both themes since `surface-sunken < surface` is the established elevation direction.

---

## 3. Attaching an existing entity — the wizard control

**Recommendation: a compact strip, not a second card.**

```html
<div class="flex flex-wrap items-center bg-surface-sunken border border-default rounded-md gap-2 mb-3 px-3 py-2">
  <label class="text-muted text-sm shrink-0" for="attach-location">Add an existing location</label>
  <app-custom-select
    id="attach-location"
    class="flex-1 min-w-[12rem]"
    [formControl]="attachControl"
    [options]="attachableLocations()"
    [searchable]="true"
    size="compact"
    placeholder="Search your locations…"
    emptyText="Every location you've made is already in this mystery." />
</div>
```

Why a strip and not Yoshi's "second, smaller card" (§5.3): two stacked bordered cards at 42% width read as two equally-weighted forms and create a "which one do I use?" moment at the exact point the user is least sure. The strip borrows the roster's own chrome — it is literally the class string the location summary rows use today (`mystery-create-locations-phase.html:3`) — so it reads as *part of the roster machinery*, one tier lighter than the composer. Two tiers, one decision.

**Single-select, commit-on-pick.** Choosing an option attaches immediately: the card appears in the roster above, the select resets to its placeholder, and the chosen option is filtered out of the options list. No "Add" button — a second control there would be a third accent-ish button in the column competing with `+ Add Another X` and `Next →`. Multi-select was considered and rejected for that reason; the searchable single-select is two keystrokes and a click per attach, and the roster gives instant confirmation.

**Option labels.** `optionLabel` = name; `optionSubLabel` = the entity's type name (custom-select's default `resolveOptionSubLabel` already falls back to `description`, which is worse here — pass an explicit `optionSubLabel`). Two locations both called "The Mill" are otherwise indistinguishable in the dropdown.

**Three states:**

| Catalogue | Already in roster | Treatment |
|---|---|---|
| empty | — | **Hide the strip entirely.** A first-run account has nothing to attach; a permanently-empty control is noise. |
| non-empty | all of it | Strip renders, select shows `emptyText` above. The control stays visible because the state is temporary and explicable. |
| non-empty | some | Normal. |

**Motion.** A newly-attached row should arrive visibly, because the user's eye is on the select, not the roster. Reuse the one keyframe this wizard already has — add `.wizard-layout .roster-card { animation: fadeSlideIn 0.2s ease forwards; }` to `wizard-layout.scss` beside `.dossier-section`, inside the same `prefers-reduced-motion` guard. This requires the `@for` to `track` a stable key rather than `$index` (§10.2), otherwise every row re-animates whenever one is removed. No new vocabulary, three lines.

---

## 4. Consistency across the four — what stays identical

Stated plainly so the review can push back on a specific item rather than the whole:

1. Roster card markup, including the `Editing` state and the two-icon action cluster.
2. Composer header wording pattern (`Add a {Noun}` / `Editing “{name}”`), footer verbs (`Save {Noun}` / `Save Changes` + `Cancel`), and button weights.
3. Composer open/collapse rule and the `+ Add Another {Noun}` button.
4. Commit-on-Next rule and the blocked-composer error-band message.
5. Attach strip markup and copy shape (`Add an existing {noun}` / `Search your {noun}s…`).
6. Removal always goes through `ConfirmDeleteModalComponent`; the modal's variant is chosen by the draft's state, not by the entity type.
7. Empty-state copy shape: `<p class="text-muted text-sm italic">No {nouns} added yet.</p>` (+ `— this step is optional.` where true).
8. Focus and announcement behaviour (§8).

---

## 5. The monster roster (Yoshi's M3)

Nothing here diverges from the minion roster except scale, so this section is short on purpose.

- **Step 0 of phase 1 becomes roster + composer.** Same card, `bg-badge-monster` type badge, secondary line `Attacks: n · Powers: n · Armors: n · Weaknesses: n · Minions: n`. The minion count on the monster card is the link between the two steps and is worth including even though it costs a cross-reference.
- **Keep the two-step split** (step 0 monsters, step 1 minions). It is shipped, the tracker already reflects it, and folding minions into the monster composer would nest a composer inside a composer at 42% width. Rejected.
- **The archetype field is the only extra core field**, and it already has a required-error line at `mystery-create-monster-phase.html:28-30` to carry over.
- **Attach strip source is `monsterService.getAll()`**, excluding roster members. One sentence of copy is warranted here and nowhere else: attaching a monster brings its minions with it. Put it in the strip's `emptyText` sibling — actually, put it in the step blurb, once: "A monster you attach brings its minions with it." That is information, not a warning, and it is the one non-obvious consequence of attach.
- **Dossier.** Mirror what Luigi shipped for minions: one `Monsters` section (rename from `The Monster`), one compact name + badge + counts entry per roster draft, with **exactly one expanded** — the one loaded in the composer — via the `ng-template` + `ngTemplateOutlet` swap at `mystery-create-dossier.html:133-135`. Do not render N full monster blocks; the dossier would become taller than the form.
- **`monsters[0]` truncation.** Fixing it is a side effect, not a feature, but it is worth one line of the release note: mysteries that already have more than one monster start showing all of them.

---

## 6. The monster picker inside the minion composer

The precedent is `minion-create.html:14-30` and it should be copied, including its conditional half:

| Roster state | Treatment |
|---|---|
| **Exactly one monster** | No picker. Render the prose line: `Belongs to <strong>{{ monsterName }}</strong>` as `<p class="text-muted text-sm mb-4">`. This is `isMonsterLocked()`'s shipped behaviour and it keeps the common single-monster case at zero extra clicks. |
| **Two or more** | A picker, as the **first field of the composer**, above Minion Name: `<label class="text-primary block text-sm font-semibold mb-[0.35rem]">Belongs to Monster <span class="text-danger">*</span></label>` + `<app-custom-select>` with `placeholder="Select a monster..."`, and the required-error line `<span class="text-danger block text-[0.8rem] mt-1">A minion must belong to a monster.</span>` — the same sentence `minion-create.html:28` already uses. |
| **Zero monsters** | The minion step cannot do anything useful. Suppress the composer and the attach-less roster, and show `<p class="text-muted text-sm italic">Add a monster first — minions belong to a monster.</p>`. (Today this state is impossible because the monster is mandatory and singular; under a roster it becomes reachable.) |

Two calls worth naming:

- **First field, not last.** It is the minion's parent; every other field is meaningless without it, and putting it last invites filling in a whole minion before discovering it is unassigned. The wizard's own field order elsewhere is identity-first (name, then type), and "which monster" is more identity than "what type."
- **The picker's options are wizard-local drafts, not the monster catalogue.** A roster monster may have `id: null`. So the control's value cannot be a server ID — see §10.2.
- **Reparenting is allowed, and the picker stays enabled for already-saved minions.** ~~It is a `PUT` of `MonsterId` at submit.~~

  > **Corrected 2026-09-20 — that mechanism never existed.** `UpsertMinionRequest` carries no `MonsterId` and `MinionService.UpdateAsync` never sets one, so the "field edit" I described would have returned `200` and silently done nothing — a reparent that reports success and changes nothing is worse than one that fails. Bowser is building a **dedicated reparent verb**; the picker's change is applied by that call at submit, not by the minion `PUT`. Skyler's answer 2 ("we should build it now") is what makes this reachable, so there is no locked-picker fallback for saved minions and no "a minion stays with the monster it was made under" sentence to write.
  >
  > **Not affected:** the one-monster prose fallback two rows above. That one is about *how many options exist*, not about whether the minion is persisted — with a single monster on the roster there is nothing to choose, saved or not. The two are easy to conflate; only the persistence-based lock is gone.
- **Removing a monster removes its minions.** The monster's removal modal must list them in `[items]` (§7), and the minion roster must drop them. This is the one cascade in the design and it must not be silent.

---

## 7. The removal confirmation modal

One modal, four copy variants, chosen by the draft's state and by whether the call site has a mystery context. Built by extending `ConfirmDeleteModalComponent` rather than writing a second dialog — that component has already absorbed `verb`, `confirmLabel`, `permanenceNote` and `items` by exactly this kind of extension, and a parallel dialog would drift.

### 7.1 The variants

> **Revised 2026-09-19 after Skyler's answers 1-7.** Three changes: Detach is now offered whenever the entity exists in the catalogue (his answer 2, taking my OQ1 recommendation over his own earlier rule); the modal extends to the non-wizard list pages in the same change set (his answer 7), which adds a fourth variant; and the minion cascade is confirmed (his answer 5), which forces the two-list split below. There are now **four** variants, not three.

#### The two lists, and why they can't be one

A monster removal has to answer two different questions at once: **where is this used** (drives Detach vs. Delete) and **what gets destroyed with it** (drives Delete vs. Cancel). Those are different lists and they cannot share `[items]`.

`[items]`'s shipped meaning is already the second one, in two places: `monsters-list.html:50-51` passes minion names with `[message]="'This will also delete the following minions:'"`, and the wizard's minion roster passes sub-resource counts. **So the cascade list is not new and must not be displaced** — Skyler's answer 5 is already true on the monsters list; what's new is doing it in the wizard roster.

Therefore the usage list is the new block: add `[usage]` + `[usageMessage]`, rendered *above* the existing `[message]`/`[items]` pair. Correcting my own earlier claim: `[items]` is **not** "passed `[]` everywhere" — `monsters-list.html:51` is a live counter-example and is in fact the precedent for this whole treatment.

Render order, top to bottom: title → `usageMessage` + `usage[]` → `message` + `items[]` → footnote → buttons.

One further fix required: `permanenceNote` currently only renders **inside** the `items.length > 0` branch (`confirm-delete-modal.component.html:18-20`), so it silently disappears for a flat Location with nothing to cascade — exactly the common case below. Render it unconditionally, and rename it `footnote`, since it now carries button guidance as well as permanence.

> **Corrected 2026-09-19 after Phase 3 (Luigi).** I originally wrote that the shipped default `'This cannot be undone.'` "still works for every current caller." **That was wrong, and shipping it would have printed that sentence twice in ten dialogs.** The reason is the very bug this fix addresses: because `permanenceNote` never rendered, ten call sites had been passing that sentence as **`message`** instead — using `message` *as* the footnote. Render the footnote unconditionally while keeping its default, and both fire. **The default must be `''`.**
>
> Worth being precise about the ten, because the count in the shipped code comment and spec (`confirm-delete-modal.component.ts:64`, `.spec.ts:154`) says *seven* and undercounts: seven call sites pass the sentence explicitly as `message` (`playbook-admin`, `bystanders-list`, `hunters-list`, `locations-list`, `hunter-detail`, `minions-list`, `monsters-list`), and **three more pass no `message` at all and inherit its default, which is the same sentence** — `mysteries-list.html:42-47`, `monster-detail.html:236-241`, `minion-detail.html:206-211`. Those three are the easy ones to miss, and they double exactly the same way. The fix is identical either way, so nothing shipped wrong; the number in the comment is what's off.
>
> One non-obvious consequence Luigi surfaced rather than folded in: **`monsters-list` *with* minions genuinely did render that line before** — `message` carried the minions lead-in, `items` carried the names, and the old `permanenceNote` default rendered underneath because `items.length > 0` was true. So that branch loses a line it used to have unless the page passes an explicit footnote, which it now does. The no-minions branch is the one that would have doubled.
>
> **Why my wrong version read as safe, since that is the reusable part:** I reasoned about the default from the component's own declaration and from what the input was *named for*, without checking what callers actually passed into the adjacent input. A default is only "safe to keep" relative to its real call sites, and when a fix changes *whether* a block renders, every caller's other inputs become part of the blast radius. Same class of error as assuming `[items]` was unused — both times I characterised an input from the component's side of the boundary instead of the consumers'.

#### The variants

> **Corrected 2026-09-20 from Peach's acceptance criteria (G3).** The key below used to be `id === null` versus `id !== null`, and that was wrong the moment attach existed: **an attached entity has an `id` the instant it is attached.** So attaching a location by mistake and trashing it a second later offered `Detach` (a no-op against a membership that was never created) and `Delete` (which permanently destroys a catalogue entity the user only meant to un-attach). Peach's product position — plain **Remove**, no call, no disposition, catalogue deletion stays on `/locations` — is right, and is adopted as variant (A2).
>
> **The variant is now keyed on consequence, not on provenance:** *is there a persisted membership that removal would actually change?* That is the baseline question, not the `id` question. Two of the three variants fall out of it.
>
> Same shape as the trap in §14.2, pointed the other way: there a stale default made the dialog say something false, here a stale key made it offer something dangerous. Both were rules that were correct when written and stopped being *complete* when a new state appeared. **When a feature adds a state, re-derive every table that keys on the old ones** — the table will not fail loudly.

| Condition | What removal actually does | Variant |
|---|---|---|
| `id === null` — authored here, never saved | discards local typing | **(A1)** Cancel · Remove |
| `id !== null`, membership **not** in the phase baseline — attached in this session, not yet submitted | un-attaches something that was never attached server-side; the entity is untouched | **(A2)** Cancel · Remove |
| `id !== null`, membership **in** the phase baseline | a real detach or a real delete is available | **(B)** / **(C)** Cancel · Detach · Delete |

**Coordinate the predicate with Yoshi rather than assuming it.** He is deciding whether the submit diff keys on the baseline instead of on `id`; if it does, the modal reads the same predicate as the diff, which is the outcome to want — one fact, two consumers, no chance of them disagreeing about what removal will do. If he keys the diff differently, the modal still needs *"is this membership in the baseline"* exposed to the phase component. Either way the variant table above is the design; only its input plumbing is open.

One thing that already works in our favour: **a successful phase submit refreshes the baseline** (`existingBystanderIds` at `mystery-create.store.ts:1417`, and its locations twin). So an entity attached this session, submitted with Next, and then removed on a revisit correctly moves from (A2) to (B)/(C) — by then a real membership does exist. No extra work; worth knowing it is load-bearing so it is not "tidied away."

**(A1) Wizard · never persisted** — authored here, `id === null`. Nothing exists on the server; the draft is local typing.

> **Remove “Ferris Mill”?**
> This location hasn't been saved yet. Removing it discards what you typed.
> `[ Cancel ]  [ Remove ]`

`verb="Remove"`, everything else empty. Matches the shipped minion logic at `mystery-create-monster-phase.ts:67-71`, which already returns an empty permanence note for unsaved drafts.

**(A2) Wizard · attached this session, not yet submitted.** The entity is real and stays real; only a not-yet-created membership goes away. Nothing is deferred, because there is nothing to defer — so, like (A1), no footnote.

> **Remove “Sheriff Dalton”?**
> This bystander stays in your bystanders list — it just won't be part of this mystery.
> `[ Cancel ]  [ Remove ]`

`verb="Remove"`, `message=""`, `usageMessage` as above, `usage=[]`, `footnote=""`, no `secondaryLabel`.

Note the sentence does the work the missing `Detach` button would have done: it states the outcome the user almost certainly wants ("it stays in your list") rather than making them choose between two verbs to get it. **This is the one variant where offering fewer buttons is the safer design, not the lazier one** — and it removes the only path by which a mistaken attach could destroy someone's catalogue entity.

**(B) Wizard · persisted, no other mysteries.** Detach is offered here — this is the case Skyler's answer 2 opened up.

> **Remove “Ferris Mill”?**
> This location isn't used by any other mystery.
> *Detach keeps it in your locations list. Delete removes it for good. Either way, the change takes effect when you continue to the next step.*
> `[ Cancel ]  [ Detach ]  [ Delete ]`

`usageMessage = "This location isn't used by any other mystery."`, `usage = []`, `footnote` as italicised above.

> **Corrected 2026-09-20 from Peach's acceptance criteria (G2) — the deferral clause is false on the last phase.** Bystanders is `lastPhaseIndex` (`mystery-create.store.ts:273-277`), so its button reads **Finish**, not `Next →` (`mystery-create.html:34`), and `submitPhase3` submits, toasts, and `router.navigate`s to the mystery detail page (`:1421`). There is no next step to continue to.
>
> The sentence cannot simply be dropped: **it is the only thing carrying the deferred-execution model to the user**, and §7.3 rules out replacing it with "This cannot be undone," which is false at the moment it is read. So the last clause of the footnote branches, and only that clause:
>
> | Phase | Closing clause |
> |---|---|
> | not the last | `Either way, the change takes effect when you continue to the next step.` |
> | the last (Bystanders) | `Either way, the change takes effect when you press Finish.` |
>
> **Derive the branch from `store.currentPhase() === store.lastPhaseIndex`, don't hardcode it per phase component.** Hardcoding is tempting — Locations is never last and Bystanders always is, so each component could just state its own — but it silently rots the first time a phase is inserted or reordered, and this feature is *already* adding a monster roster in Phase 5. One expression that cannot go stale beats two strings that can.
>
> Naming the button in the copy is deliberate: it matches the literal control the user is looking at, which is stronger than a generic "when you continue." The minion phase's existing note (`'The minion will be deleted when you continue to the next step.'`) is unaffected — phase 1 is never last — but it should read from the same helper so there is one place this wording lives.
>
> **This does not disturb the `message=""` binding from §14.2.** The deferral clause lives in `footnote`, which now defaults to `''`; `message` still defaults to `'This cannot be undone.'` and must still be passed explicitly as `""` on every wizard variant. The two are adjacent and easy to conflate, which is exactly why both are called out.

**(C) Wizard · persisted, used by other mysteries.**

> **Remove “Sheriff Dalton”?**
> This bystander is also used by 2 other mysteries:
> • Dust Bowl Nights
> • The Long Drive Home
> *Detach removes it from this mystery only. Delete removes it from those mysteries too. Either way, the change takes effect when you continue to the next step.*
> `[ Cancel ]  [ Detach ]  [ Delete ]`

`usageMessage = "This bystander is also used by {n} other {mystery|mysteries}:"`, `usage = [names]`. The closing clause branches on the last phase exactly as in (B) above — and note that **the bystander example here is the one that hits it**, since Bystanders *is* the last phase: in the running wizard this dialog ends "…when you press Finish." **Both halves of Skyler's condition are met by one string:** he asked that the modal indicate *how many* other mysteries (answer 2) and separately approved fetching the list so we can *name* them (answer 3). The count is stated in the sentence and the names are listed beneath it, so naming does not replace counting — a user who only wants the number gets it without reading the list. Pluralisation must be real (`1 other mystery` / `2 other mysteries`); `pendingRemoveItems` at `mystery-create-monster-phase.ts:44-60` is the shipped singular/plural helper to copy.

A monster in this state carries both lists:

> **Remove “The Hollow Man”?**
> This monster is also used by 1 other mystery:
> • Dust Bowl Nights
> This will also delete the following minions:
> • Grave-Wight
> • Pale Choir
> *Detach removes it from this mystery only. Delete removes it from those mysteries too, along with its minions. Either way, the change takes effect when you continue to the next step.*
> `[ Cancel ]  [ Detach ]  [ Delete ]`

Note that the cascade sentence is factually attached to **Delete only** — Detach leaves the minions alone, because they travel with the monster (Skyler's answer 6) rather than with the membership. The footnote has to say so or it implies minions die either way.

**(D) List page · no mystery context** — new, from answer 7. `verb="Delete"`, and **no Detach button**; see §7.2.

> **Delete “Sheriff Dalton”?**
> This bystander is used by 2 mysteries:
> • Dust Bowl Nights
> • The Long Drive Home
> *Deleting removes it from those mysteries too. This cannot be undone.*
> `[ Cancel ]  [ Delete ]`

When it belongs to none: `usageMessage = "This bystander isn't used by any mystery."`, `usage = []`, footnote `This cannot be undone.` Note the wording shift — **"used by 2 mysteries", not "2 other mysteries"** — because on a list page there is no current mystery for the others to be other than. That one word is the whole difference between the wizard and list copy, and getting it wrong makes the count read as off-by-one.

`usage` and `items` both render as `bg-surface-sunken border border-default rounded-md … max-h-[150px] overflow-y-auto` with `list-disc`, so a recurring villain in nine mysteries is already handled.

### 7.2 Buttons

- **Detach requires a mystery context, and only the wizard has one.** This is the load-bearing constraint on answer 7 and it is worth stating before the styling: "Detach" means *remove from **this** mystery*, so on `/locations` — a flat catalogue with no current mystery — there is nothing for it to detach from. Variant (D) is therefore two buttons, not three. What the list pages gain from this work is the **usage disclosure**, not the third button. See §7.6.
- **Order, left to right: Cancel · Detach · Delete.** `Delete` stays rightmost and stays `bg-danger text-on-danger`, because rightmost-is-the-danger-button is the shape of every confirm in this app and moving it per-variant would be worse than anything it buys.
- **`Detach` takes the outline-accent treatment** (`bg-transparent border border-accent rounded-md text-accent … hover:bg-accent-subtle`), not a filled accent. Two filled buttons of different hues side by side make neither dominant; outline-vs-filled reads instantly as safe-vs-destructive.
- **The `Detach` / `Delete` labels share a prefix,** which is a legibility risk at a glance. Considered `Unlink` (the API's internal verb) and `Remove From Mystery` (too long for a three-button row at this modal's `max-w-[420px]`). Recommending `Detach` anyway, because "Attach to Mystery" is already the shipped user-facing copy on the create pages and `Detach` is its exact mirror, and because fill weight and colour carry most of the discrimination. **Settled 2026-09-19 (OQ4): "Detach and Delete is fine. I understand the risk, but it's not a concern for me."** Recording that precisely — the risk was presented, understood and *accepted*, not judged absent. If a misclick between the two is ever reported, this is the decision to revisit first, and the mitigations already identified (relabel to `Unlink`, or move `Delete` out of the default rightmost slot) are both still available.
- **`Cancel` keeps its current neutral treatment**, unchanged.

### 7.3 Deferred execution

**Confirmed by Skyler's answer 4** ("removals occur at the next step click"). The modal decides a **disposition**, it does not perform an action. Nothing is deleted or unlinked until the phase submits — consistent with the wizard's standing "submission happens at phase transitions" decision and with the shipped minion behaviour. Hence the italic `permanenceNote` line: *"Changes take effect when you continue to the next step."* — the same wording shape as the shipped `'The minion will be deleted when you continue to the next step.'`.

Which means the removal also has to be *undoable before that*, or the note is a lie. It isn't undoable today for minions either, and I am not proposing an undo. But do not say "This cannot be undone" in variants B and C, because at the moment the user reads it, it isn't true yet. Use the deferral note instead — and keep the hard `This cannot be undone.` for the list pages, where delete is immediate.

### 7.4 Membership changes inside a form never confirm

Unchecking a mystery chip in the `MysterySelectComponent` on a location's edit form is **not** a removal event and must not raise this modal. It is a form edit, reversible until Save, and confirming it would train dismissal on a dialog we need people to read. The modal belongs to the roster trash icon and the list-page trash icon only.

### 7.5 The non-wizard surfaces — in scope, per answer 7

I originally filed this as "out of scope but cheap." Skyler's answer 7 puts it in the same change set, which is the right call and resolves the one real disagreement between this doc and Yoshi's: the list pages' hard delete is the highest-consequence delete in the app, and shipping the wizard's disclosure first would have left two modals that disagree about the same entity.

But "extend to lists/details" turns out to mean less than it sounds, and the audit below matters more than the instruction. **Of the thirteen `<app-confirm-delete-modal>` elements in the app, only three need anything**, and one surface that genuinely wants the full three-button treatment doesn't have a delete affordance to extend.

> **Count corrected 2026-09-19 after Phase 3.** Thirteen elements across twelve template files — `hunter-create.html` is the only page with two (a playbook-switch confirm at `:57` and a discard confirm at `:69`). Two earlier numbers were wrong in both directions and the method is the lesson: my original "fourteen" came from a `files_with_matches` grep, which counts **files, not elements**, and included `confirm-delete-modal.component.ts` and its spec — neither of which is a call site. A later recount landed on fourteen by treating the closing `></app-confirm-delete-modal>` tags on `monster-detail.html:241` and `minion-detail.html:211` as second elements; they are the same elements' closing tags. Count elements with an opening-tag pattern, not files, and not matches.
>
> The audit's **conclusion is unchanged** — still exactly three surfaces need work.

### 7.6 Call-site audit

| Surface | Entity-level delete today? | Mystery context? | What it needs |
|---|---|---|---|
| `monsters-list`, `locations-list`, `bystanders-list` | Yes — trash → hard `DELETE` | **No** | **Variant (D).** The three surfaces this work actually touches. `monsters-list.html:50-51` already passes the minion cascade, so it needs `usage` added, not rebuilt. |
| `mystery-detail` asset lists | **No remove affordance at all** (`mystery-detail.html:88/108/129/149` are bare links) | **Yes** | The only non-wizard home for the full `Cancel · Detach · Delete`. Requires *inventing* a remove affordance, which is Yoshi's Phase 5 idea, not this design. **→ New OQ10.** |
| `monster-detail`, `minion-detail` | Only for sub-resources (attacks / powers / armor / weaknesses) | n/a | **Nothing.** A monster attack has no mystery membership. Leave alone. |
| `location-detail`, `bystander-detail`, `monster-detail` (the entity itself) | **No** | n/a | **Nothing to extend.** These pages have no entity-level delete button; adding one is a separate product decision. |
| `mysteries-list`, `hunters-list`, `hunter-detail`, `minions-list`, `playbook-admin`, `hunter-create` | Yes | n/a | **Nothing.** Mysteries, hunters and playbooks have no mystery membership; a minion reaches a mystery only through its monster, so its own delete has no usage list to show. |

The practical read for Luigi: answer 7 is **three template edits plus the component's new inputs**, not a sweep.

### 7.7 As built in Phase 3

Recorded because the input surface is now the contract three more phases will code against.

`itemName`, `visible`, `verb` and `confirmLabel` are unchanged. **New:** `usageMessage: string = ''` and `usage: readonly string[] = []`, rendering above. `message` and `items` are unchanged and keep the cascade meaning specified in §7.1. `permanenceNote` is **renamed `footnote`**, renders unconditionally, and defaults to `''` (see the correction in §7.1). **New:** `secondaryLabel: string | null = null` with a `(secondary)` output — the Detach slot.

Two implementation details worth keeping:

- **The render order is asserted as an ordered list of blocks**, not just as individual presence checks: title → `usageMessage` + `usage` → `message` + `items` → `footnote` → buttons. Order is load-bearing here (usage drives Detach-vs-Delete, cascade drives Delete-vs-Cancel, per §7.1) and presence-only assertions would let it silently reshuffle.
- **Initial focus lands on the secondary button when present, otherwise Cancel, never the confirm** — §8.5 as specified.

**Copy is centralised in `shared/mystery-usage.ts`** so the three swept pages cannot drift, which is the right call and is where the "*2 mysteries*, not *2 other mysteries*" rule from §7.1 is now enforced in exactly one place. One detail there is better than what I specified: **the count is taken from the resolved-names array rather than from `mysteryIds`**, so the sentence and the list always agree even when an ID fails to resolve. I had left that gap open by implying the count came from the IDs; taking it from the names makes "2 mysteries:" followed by two bullets an invariant rather than a coincidence.

#### If the mystery fetch fails — ratified with one change

Luigi's call was to **suppress the usage block entirely** rather than let it default to "isn't used by any mystery," on the grounds that a false zero on the app's most consequential destructive action is worse than no claim. **I agree with that reasoning and it is the right instinct** — never state a zero we haven't verified.

**But I'd change the treatment, because silence reproduces the error it avoids.** Once users learn this modal always tells them where an entity is used, an *absent* block reads as "used nowhere" just as a false sentence would — the inference is the same, only quieter, and it is unfalsifiable from the user's side. Say the check failed:

> `usageMessage = "Couldn't check which mysteries use this location."`, `usage = []`, footnote unchanged (`This cannot be undone.`)

Same block, no new input, one string. It turns an invisible failure into a visible one, and on an irreversible action the user can then cancel and retry rather than delete blind. **The confirm button stays enabled** — a network blip must not block a legitimate delete, and the user now has what they need to decide.

If that copy is unwelcome, suppression remains a defensible fallback; it degrades to exactly today's shipped modal. But specifying it is cheap, so it should be specified.

---

## 8. Accessibility requirements

These are requirements, not polish. Items 1, **6** and 5 were live defects in the shipped minion roster that would have got four times worse when replicated to four phases — item 6 was identified during Phase 3 and belongs to that same set.

**Phase 3 shipped items 1, 4, 5, 6 and 7.** **Items 2 and 3 remain**, and both should land with the roster replication rather than after it.

1. **Focus when a row is pulled into the composer.** Activating the pencil **unmounts that pencil** (it is replaced by the static `Editing` label), so keyboard focus is currently orphaned to `<body>` and the user is dropped at the top of the document. Required: give the composer header `tabindex="-1"` and, in `afterNextRender({ write })`, call `heading.focus({ preventScroll: true })` — the exact idiom already in `wizard-layout.ts:54-60`. Focusing the *heading* rather than the name input is deliberate: the heading text is "Editing “Sheriff Dalton”", so taking focus announces the mode change with no `aria-live` needed, and `Tab` from there lands on the first field.
2. **Announce roster changes.** One visually-hidden polite status region per phase (`<p class="sr-only" aria-live="polite" role="status">`), written on save / attach / remove: "Sheriff Dalton added." / "Sheriff Dalton updated." / "Sheriff Dalton removed." Without it, attach-on-pick is completely silent to a screen reader — the only feedback is a card appearing elsewhere on the page.
3. **Composer grouping.** `role="group"` + `aria-labelledby` pointing at the composer heading, so the heading's mode text is part of every contained field's context, not just a visual caption.
4. **Roster action buttons need names that include the entity.** Today they carry `title="Edit minion"` — generic, and `title` is a fragile accessible-name source. Required: `[attr.aria-label]="'Edit ' + draft.name"` / `'Remove ' + draft.name`, keeping `title` for the mouse tooltip. In a roster of five, "Edit minion, button" five times is unusable.
5. **The confirmation modal needs real dialog behaviour.** It currently has `role="dialog" aria-modal="true"` and nothing else: no initial focus, no focus trap, no `Escape`, no focus restore. With a third button and a genuinely consequential choice this is no longer acceptable. Required:
   - Initial focus on the **least destructive actionable** control — `Detach` when present, otherwise `Cancel`. Never `Delete`.
   - `Tab`/`Shift+Tab` cycle within the dialog.
   - `Escape` cancels (same handler as the backdrop click).
   - On close, focus returns to the trash button that opened it — which requires the caller to hold that element reference, since the row may still exist (cancel) or may not (confirm); when it does not, fall back to the composer heading or the phase's first focusable control.
   - Add `aria-describedby` on the dialog pointing at the message paragraph, so the Detach-vs-Delete explanation is announced, not just the title.
   - Note: `id="modal-title"` is hardcoded, so two instances of this component on one page would produce duplicate IDs. The wizard only ever renders one at a time, but Luigi should make the ID unique while he is in there.
6. **Focus after the composer collapses — the same defect as item 1, on the other edge. Required, and not yet done.** `Save Changes` and `Cancel` **unmount their own buttons** when the composer collapses, exactly as the pencil unmounts itself in item 1, so focus is orphaned to `<body>` on the way out just as it was on the way in. Required: focus moves to `+ Add Another {Noun}`, which occupies the same screen position the Save button just vacated.

   OQ2 settled that the composer **always** collapses after save, for all four entities, so the "if it stays open, focus the name input" branch I originally wrote here is dead — there is one path, not two.

   **Shipped in Phase 3** (`mystery-create-monster-phase.ts`, `saveDraft` / `cancelDraft` / `afterComposerCollapse`), alongside item 1 rather than after it. The reasoning is kept because it is the rule, not just the outcome: this item was *not* in Phase 3's original scope, and the argument for pulling it in was that it is a defect in the **already-shipped** composer which replicating the composer would multiply by four. §12.1 is for work deferred past the whole feature; this was work the feature makes worse. Items 1 and 6 are one pair — the entry and exit of the same focus contract — and fixing only one would have left a keyboard user able to get into the composer but not out.

   **Phase 4 replicates both halves.** The contract for each new phase is: pencil and `+ Add Another {Noun}` focus the composer heading; `Save` and `Cancel` focus `+ Add Another {Noun}`. Both guarded on the composer having actually changed state, so a refused commit leaves focus on the button the user pressed.
7. **Keyboard access to the attach select — `Escape` closes and restores focus. In scope; settled 2026-09-19 (OQ8):** *"Include Escape closes and restores focus as part of this scope."* Yoshi is placing it in his Phase 3 alongside the other roster foundations.

   `CustomSelectComponent` is operable today — the trigger is a real `<button>` with `aria-expanded` and the options are real `<button>`s — but the panel can only be dismissed by clicking elsewhere (`handleDocumentClick`, `custom-select.component.ts:87-92`), which a keyboard user cannot do. The fix, concretely:

   - Add a template ref to the trigger (`#trigger` on `custom-select.component.html:8`) and a `@ViewChild('trigger') private readonly trigger!: ElementRef<HTMLButtonElement>`.
   - Add `@HostListener('keydown.escape', ['$event'])`. A host listener (not one on the trigger) is required because `keydown` must also be caught from the searchable variant's `<input>` inside the panel.
   - Handler body, in order: **if `!isOpen()` return immediately without touching the event**; otherwise `event.stopPropagation()`, `event.preventDefault()`, `isOpen.set(false)`, `searchTerm.set('')` (matching what `toggleOpen()` already does on close), then `trigger.nativeElement.focus()`.

   **The early return and the `stopPropagation()` are the load-bearing lines, and they exist because of item 5 above.** Once the confirm modal also closes on `Escape`, a select rendered *inside* that modal must swallow the first `Escape` (closing only the dropdown) and let the second one through (closing the dialog). Returning early when the panel is already closed is what makes the second `Escape` reach the dialog; `stopPropagation()` is what stops the first one from closing both at once. Getting either wrong produces a dropdown that takes the whole dialog down with it.

   **Verification (Toad):** panel open + `Escape` → panel closes, `document.activeElement` is the trigger, `searchTerm` is cleared; panel closed + `Escape` → no-op and the event is *not* consumed; `Escape` from inside the search input behaves identically to `Escape` from the trigger; a select inside the confirm modal takes two `Escape` presses to close both, in that order, never one.

   > **Built as specified in Phase 3, nesting interaction included.** One typing gotcha worth recording for whoever touches this next: the `$event` parameter of a `keydown.escape` **pseudo-event** must be typed `Event`, not `KeyboardEvent`, or the build fails with `TS2345`. Angular's pseudo-event syntax does not narrow the event type the way a plain `keydown` binding does — an easy hour to lose, since the handler body reads as obviously keyboard-specific.

   **Explicitly out of scope:** the rest of this component's ARIA — `role="listbox"` sits over children that are not `role="option"`, there is no `aria-activedescendant`, and there is no arrow-key navigation. Pre-existing, untouched here, and recorded in §12.1 as a follow-up so it isn't mistaken for having been fixed.
8. **Colour is never the only signal.** The loaded roster card pairs `bg-accent-subtle border-accent` with the literal word `Editing`. Keep the word. Same rule for any future "shared" or "attached" indicator.
9. **Motion.** The only new motion is the row-entrance reuse of `fadeSlideIn` (§3), inside the existing `prefers-reduced-motion` guard. **Do not animate the composer's expand/collapse height** — it is a ~700px delta in a scrolling column, which scroll-jumps the panel and is exactly the problem the roster pattern exists to avoid.

---

## 9. The standalone edit forms — the mystery-select control

### 9.1 Placement: inside the form, as its last field

Today's picker sits *outside* `<app-location-form>`, above it, at `max-w-md` against the form's `max-w-[30rem]` — two near-identical column widths stacked with a single submit button underneath, which already reads as two forms sharing one button. It is also create-only and single-valued.

Recommendation, matching Yoshi §4.3: the membership control becomes **a field of the form component's own `FormGroup`**, rendered last, immediately above the submit button, in the same `<label class="grid font-medium gap-1">` shape as every other field:

```html
<label class="grid font-medium gap-1">
  Mysteries
  <app-mystery-select formControlName="mysteryIds" [options]="mysteries" />
</label>
```

No required asterisk — zero mysteries is a valid state and the flat catalogues exist to hold those entities. This deletes the bespoke `mysteryControl` from all three create pages and gives the detail/edit pages the capability they have never had.

**Last field, not first,** because membership is metadata about the entity's use, not part of its identity, and the form's existing order is identity-first (name → description → type). The create pages putting it first is an artefact of it having been bolted on outside the form.

### 9.2 `MysterySelectComponent`

A near-copy of `WeaponTagSelectComponent` (`ControlValueAccessor` over `string[]`, chips above a `[multiple][searchable]` custom-select). Two deliberate differences:

- **Chips use the mystery domain badge, not the weapon-tag chip.** `bg-badge-mystery text-on-badge-mystery` with the shared badge class string `rounded-full text-[0.72rem] font-semibold tracking-[0.02em] px-[0.55rem] py-[0.15rem] whitespace-nowrap`. `search-results.ts:81` already establishes amber as the Mystery domain colour app-wide; using the indigo weapon-chip here would put an accent-coloured chip inside a form for a non-accent concept.
- **`optionSubLabel` = adventure type name** (`MysteryListItemResponse.adventureType.name`), so two similarly-named mysteries are distinguishable in the dropdown.

Removal is by unchecking in the dropdown, exactly as weapon tags work today. Chips stay display-only; a per-chip `×` would be a second removal mechanism for the same thing.

### 9.3 Disagreeing with Yoshi §4.4 on one point: the chips should not be links

Yoshi suggests the membership chips be `.entity-link` anchors to those mysteries. I recommend against it **inside the form control**: these chips live in a form that is frequently dirty, and a link that navigates away mid-edit is a data-loss trap dressed as a convenience.

> **Corrected 2026-09-19:** an earlier draft of this section said the app has no unsaved-changes guard. It has one — `features/hunters/pages/hunter-create/hunter-draft.guard.ts`, a `CanDeactivateFn` whose own comment calls it "the app's first," registered at `hunters.routes.ts:15` and paired with a `window:beforeunload` `@HostListener` at `hunter-create.ts:134`. What is true is narrower: **no guard covers the entity detail/edit pages**, which is where these chips would live. The recommendation is unchanged — an unguarded link out of a dirty form is still a trap — but the correction improves the follow-up below, because the escape route is now a shipped pattern to copy rather than a mechanism to invent.

If cross-navigation from a location to its mysteries is wanted, it belongs in a separate read-only line in the page header area — the `.entity-link--inline` "Belongs to X" idiom from `minions-list.html:23` — not on the editable control. I am still not proposing that line for v1 (the chips make membership legible, which was the actual gap), but it is now a smaller piece of work than I first implied: it is one line of markup, plus, if we want it to be safe rather than merely conventional, a second registration of the existing `hunter-draft.guard.ts` pattern on the three detail routes. **OQ6.**

### 9.4 No sharing warning — and what that leaves

Per Skyler's answer to Yoshi's OQ4, there is no advisory note on the edit form when an entity is in 2+ mysteries. Nothing in this design adds one. What the user gets instead is **the chips themselves**: the membership control is on screen, populated, immediately above the Save button, every time they edit a shared entity. That is passive disclosure rather than a warning, it costs nothing, and it is honest. I think that is sufficient and I am not arguing for more.

### 9.5 Partial-failure copy on the create and detail pages

> **Added 2026-09-19, ruling on two strings Luigi introduced in Phase 2 and flagged for review.** Decision 3 buys a non-atomic two-round-trip create, so "Unable to create location." became a lie in the case where the entity landed and the membership `PUT`s did not. He was right that new copy is needed. Both of his strings are **rejected as written**, and the reason is the same in both cases: **the app already solved this exact problem and the new strings invent a second voice for it.**

**The shipped convention.** `monster-create.ts:286-292` and `minion-create.ts:333-339` are the same shape as this work — an entity is created, then a second, non-atomic round of writes can fail after it. Both say:

> `"{Entity} created, but some details may not have saved. Review them on the {entity} page."`

Three properties, all deliberate, all load-bearing here:

1. **It hedges, because the truth is unknowable.** The second half is a `forkJoin` fan-out. When it errors, some of its calls may already have succeeded — `forkJoin` tells you one failed, never that all did. "may not have saved" is the only accurate tense.
2. **It carries a next step**, naming a destination, not just a diagnosis.
3. **It is not an error, it is a success with a caveat.** Both pages catch the second-half failure with `catchError(() => of({ …Failed: true }))` so it never reaches the `error:` handler; the page still navigates, `errorMessage` stays `null`, and the caveat is delivered as a toast. The comment above both reads: *"The monster now exists. A failure past this point must not look like a total failure, so it is caught here rather than reaching the error handler."* That is this ruling, written down two pages away, eighteen months before this feature.

The one thing the convention does **not** offer is a warning severity — `NotificationKind` is `'success' | 'error'` only (`core/notifications.ts:3`), and `monster-create` spends `.error()` on the caveat. Keep doing that. Do not add a third kind for this.

#### 9.5.1 Create pages — rejected, with a replacement

| | |
|---|---|
| Luigi's | ~~"Location created, but attaching it to the selected mysteries failed."~~ |
| **Adopt** | **"Location created, but some of its mysteries may not have saved. Review them on the location page."** |
| **Bystander twin** | **"Bystander created, but some of its mysteries may not have saved. Review them on the bystander page."** |

"failed" asserts total failure of the attach, which the client cannot know — select three mysteries, have the third `PUT` fail, and two of them *are* attached while the message says none are. And the string ends on the diagnosis, leaving the user on a create form with nothing to do.

**The copy change does not stand alone, and must not be landed alone.** Luigi routes the partial case into the `error:` handler (`location-create.ts:98-105`), which means the page does not navigate, `errorMessage` is set, and the user is left looking at a populated create form whose only control is a **Create** button that will create a *second* location. That is the real defect; the wording is a symptom of it. Adopt the mechanism with the words: `catchError` on the batch, take the success path, navigate, toast the caveat, leave `errorMessage` null, and do not also fire the "Location created." success toast.

**One consequence to catch while changing it.** `detailLink()` routes to the mystery-scoped URL when exactly one mystery was selected. Once the page navigates on partial failure, that route asserts a membership we no longer know holds. **On the partial-failure branch, always use the flat `/locations/{id}` route**, whatever the selection count.

#### 9.5.2 Detail pages — rejected, and the fix is a refetch, not a sentence

| | |
|---|---|
| Luigi's | ~~"Location saved, but its mysteries could not be updated."~~ |
| **Adopt** | **"Location saved, but some of its mysteries may not have saved. Review them below and save again."** |
| **Bystander twin** | **"Bystander saved, but some of its mysteries may not have saved. Review them below and save again."** |

Same hedge problem — "could not be updated" asserts a total failure of a fan-out that may have partly landed. But the detail page cannot borrow the create page's next step, because the user is *already on* the page that copy points to. So the next step has to be delivered by the page itself, and this is where the ruling stops being about copy:

**After a partial failure the page's state and the server's state disagree, and the page's state is the one the user will act on.** `save()` sets the entity optimistically — `map(() => ({ ...location, mysteryIds: desired }))` (`location-detail.ts:112`) — so on success the picker shows what was *asked for*, and on failure `location()` is not updated at all, so the picker's baseline is the pre-save set while the server holds a mixture. Two things follow:

- **Requirement: refetch on completion, both branches.** Use the house idiom — `monster-detail.ts:315-346`'s `runAndRefresh` already does `switchMap(() => getById(id))` after every mutation rather than merging the payload locally, precisely so the page shows server truth. Doing the same here makes the form's `ngOnChanges` repopulate `mysteryIds` from the server, so **the answer to "which mysteries failed?" is the control itself, re-rendered with the true set.** That is better than enumerating failed mystery names in a sentence, which was the other option considered: it needs no name lookup, no list formatting, no plural handling, and it leaves the user's next action (fix the selection, press Save) in the place they already are.
- **Requirement: the caveat must be a toast only — `errorMessage` stays `null`.** `location-detail.html:6-8` is an `@else if (errorMessage())` branch *ahead of* `@else if (location())`, so setting `errorMessage` **unmounts the form, the membership picker and the custom-moves list**, leaving a back-link and a red line. There is then no way to retry without navigating away. (This is pre-existing and app-wide — `monster-detail.html:6`, `minion-detail.html:6` and `bystander-detail.html:6` are the same chain, and `monster-detail.ts:158` sets it on save failure today. See the follow-up below. This ruling side-steps it rather than fixing it.)

**"…and save again" is only honest once the refetch ships.** Without it, the recomputed `removed` diff still contains a mystery whose unlink `DELETE` already succeeded, and unlink returns **404 on repeat** — Boo's correction in Yoshi's §4.1. So the second Save fails too, and every Save after it, permanently. The refetch resets the baseline to server truth and dissolves the loop by construction. **Do not ship the copy without it.** Yoshi's §7.3 rule 2 ("treat 404 as success when applying a recorded disposition") is the same hazard, scoped to the wizard's `pendingRemovals`; nobody scoped it to this surface, because this surface's unlink is new.

#### 9.5.3 The failure states these four pages can now reach

Checked in full, not just the two Luigi named. **Bold rows are unaddressed today.**

| # | State | Status |
|---|---|---|
| C1 | Reference data fails to load | "Unable to load reference data." — but the template has no `isLoading` guard around the form (`location-create.html:14`), so a working-looking form renders with an empty type dropdown. Self-limiting (the required validator blocks submit) and pre-existing. Inline only, no toast, unlike every other message on the page. **Follow-up, not this change set.** |
| C2 | `createStandalone` fails | "Unable to create location." Correct, conventional, retry works. Leave it. |
| C3 | Entity created, **every** link `PUT` fails | §9.5.1. |
| C4 | Entity created, **some** link `PUT`s succeed | **Same message, which asserts they all failed. False.** Fixed by the §9.5.1 hedge. |
| C5 | Partial failure, user presses **Create** again | **Creates a duplicate entity. Nothing prevents it.** The most serious state on these pages, and a pure consequence of routing the partial case into `error:`. Fixed by §9.5.1's navigate-anyway. |
| C6 | Partial failure, exactly one mystery selected | Would land on a mystery-scoped route for a mystery the entity may not be in. Only reachable once we navigate on partial failure — so it is a "don't introduce this" note, handled by the flat-route fallback in §9.5.1. |
| C7 | Zero mysteries selected | `runBatch` short-circuits to `of([])`. No calls, no new state. Fine. |
| D1 | Detail load fails | "Unable to load location details." Fine. |
| D2 | `update` itself fails | **"Unable to save location." is correct copy, but it unmounts the form and the user loses their edits with no retry.** Pre-existing across four detail pages; flagged, deliberately out of scope here. |
| D3 | `update` succeeds, **every** membership call fails | §9.5.2. |
| D4 | `update` succeeds, **some** membership calls land | **Message asserts total failure, and `location()` keeps the pre-save baseline while the server holds a mixture.** Fixed by the hedge plus the refetch. |
| D5 | Save again after D3/D4 | **Re-issues an already-applied unlink `DELETE` → 404 → fails again, every time, forever.** A live bug, not a copy problem. Fixed by the refetch; nothing else fixes it. |
| D6 | Success | Optimistic local merge rather than the house refetch. Accurate today, and the source of D4 and D5. Fold into the refetch change. |

**Follow-up, not proposed for this change set:** the `@else if (errorMessage())` branch that precedes the content branch on all four `*-detail.html` pages turns any save error into a page wipe. It is shipped behaviour with a shipped consequence (D2), it is a four-page sweep, and Toad is currently in these files. The right treatment is the one §9.5.2 uses — mutation failures toast and leave the page mounted; only *load* failures replace the content — but it should be scoped and scheduled on its own, alongside the a11y work in §8.

---

## 10. What this design asks the architecture for

Design consequences of Skyler's answers that Yoshi's current draft does not yet cover. Flagged here, not silently assumed.

### 10.1 Don't rewrite what the user didn't change — handled at the store layer

> **Corrected 2026-09-19 against Yoshi's rev 3.** My first version of this section argued the property from "attaching must never mutate the attached object" and proposed enforcing it with a third `origin` state or an `edited: boolean`. He accepts the property and rejects both the reasoning and the mechanism, and he's right on both counts. Recording the correction rather than quietly swapping it out.

**The reason I gave is dead.** Skyler *wants* attached entities to be mutable, and writing identical values back to an entity is not a mutation. The reason that survives is **write amplification**, and it is sharply entity-dependent: a flat Location costs one no-op `PUT`; a monster under the shipped delete-all/recreate-all cycle has every attack, power, armor and weakness deleted and recreated — and re-keyed — on a `Next` the user never touched. That is also not something attach introduces. It is shipped behaviour: `submitPhase2` already `PUT`s every draft with `id !== null` on every phase transition, touched or not (`mystery-create.store.ts:1323-1327`).

**The mechanism is a baseline snapshot, not a flag.** Each draft carries the values it was hydrated or attached with, and the submit diff compares row by row. Two reasons that beats what I proposed, one of which is my own objection turned around:

- A stored flag desyncs the moment someone edits a field and reverts it.
- My hardest caveat — *a cancelled edit must not count as an edit* — enforces itself for free, because a cancelled edit leaves the draft equal to its baseline by construction. There is no "loaded versus committed" rule for anyone to remember, which is the right outcome; my version put a correctness-critical distinction into interaction semantics, where it would have leaked into copy eventually.
- Per-row also beats per-entity: renaming a monster should not rewrite all eight of its sub-resources.

`origin` drops out of the submit decision entirely. It survives at most as display metadata — and per OQ5 it is not displayed either, so it may not need to exist at all. The diff becomes:

| Draft state | Action at submit |
|---|---|
| in baseline, removed, disposition `detach` | `unlinkFromMystery` (today's behaviour) |
| in baseline, removed, disposition `delete` | **`DELETE /api/{collection}/{id}`** ← new, and genuinely destructive |
| `id !== null`, membership not in baseline | membership `PUT` ← new |
| `id !== null`, values equal to baseline | **no entity write at all** ← new, and it applies to authored drafts too |
| `id !== null`, values differ from baseline | entity `PUT`, plus writes for only the sub-resource rows that differ |
| `id === null` | `create(mysteryId, …)` |

**Design consequence: none.** The roster card, the composer, the mode signalling and the removal modal are all unchanged by this. That is why it is recorded here as a note rather than an open question.

> **Addendum 2026-09-20, from a real defect Luigi found in Phase 5a that neither doc anticipated.** `POST /attacks` answers **before** its weapon tags are assigned, so storing the create response as the baseline records `weaponTags: []` against a draft that has one. The row then compares dirty **for ever**: every subsequent submit re-`PUT`s that attack and re-assigns the same tag, indefinitely. He fixed it by having `afterSave` return the response that becomes the baseline.
>
> Nothing here needs redesigning, but the rule generalises and is worth stating once, because it is the failure mode a baseline diff is uniquely prone to:
>
> **The baseline must be what the server ended up holding, not what the first call returned.**
>
> A baseline is a claim about server state. Any multi-call save — create-then-assign, create-then-link, create-then-reorder — has a window where the first response is already stale, and seeding the baseline from it makes the diff permanently wrong in the quiet direction: not a visible error, just work redone on every save. Note this is the *mirror* of the §17.2 rule about summaries and details: there, two sources that usually agree; here, one source sampled at the wrong moment.

**The one dependency is resolved, favourably.** Skyler's answer 1 approves sub-resource upsert by ID presence and explicitly endorses dirty-tracking ("I do think that dirty-tracking is the way to go with this"). So the delete-all/recreate-all cycle goes, a per-row diff can express "leave this attack alone," and the fallback branch I had flagged here — per-draft dirty tracking becoming load-bearing again, with the cancelled-edit caveat back in play — is **dropped**. Dirty-tracking survives in the form Yoshi specified: a baseline snapshot compared row by row, as an **optimisation against write amplification**, not as a correctness guard. Nothing in §2-§9 depends on it either way.

### 10.2 Drafts need a stable client key, and the roster must `track` it

The wizard `@for`s all roster lists on `track $index` today. Three things in this design break under that: the monster picker's value (a minion must point at a roster monster that may have `id: null`), the row-entrance animation (every row re-animates when one is removed), and the existing documented index-shift hazard in `removeMinionDraft` (`mystery-create.store.ts:1116-1122`). Recommend a stable per-draft client key assigned at creation/hydration, used as the `@for` track, as the picker's option value, and as `editingDraftIndex`'s replacement (`editingDraftKey`). This is a store change, not a template one, and it should land before the roster is replicated three more times.

> **Accepted in rev 3, and sequenced.** Yoshi's Phase 3, "Roster foundations," now sits ahead of the replication and carries the client key (also fixing the documented index-shift hazard at `mystery-create.store.ts:1116-1122`), the three focus/labelling fixes from §8.1/§8.4/§8.6, and `ConfirmDeleteModalComponent`'s dialog behaviour plus its secondary action. It ships as a standalone improvement to today's minion roster and is blocked by no open question in this document — which means **the accessibility items in §8 are not gated on Skyler answering anything.**

### 10.3 Drafts need to know about other mysteries — and the wizard needs mystery names

The removal modal's variants B and C turn on "is this entity in other mysteries, and which." `mysteryIds` is already on `MonsterListItemResponse` / `LocationListItemResponse` / `BystanderListItemResponse` (`core/models.ts:193, 385, …`), so the data exists — but it is not carried onto the drafts, and the wizard has no source for mystery *names*. Two asks:

- Carry `mysteryIds: string[]` onto each draft, hydrated on attach (from the catalogue item) and on edit-mode load.
- The wizard loads `mysteryService.getAll()` once, to resolve those IDs to names for the modal's `[items]`. A count alone ("also used by 2 other mysteries") is materially worse: the whole point of the list is to let the user judge whether detaching or deleting is right, and they cannot judge that from a number.

If the second is unacceptable, the fallback is the count-only copy, and variant C loses its `[items]` list. I'd rather pay one GET.

### 10.4 Disposition is new to the diff

Today, "in baseline but no longer in the list" means exactly one thing: unlink. After this, it means whatever the modal decided. `removeX(index)` needs a disposition argument and the store needs to remember it until submit. This is the one place where a UI decision reaches into the diff, and it is worth a test of its own.

---

## 11. Alternatives considered and rejected

**Inline edit-in-place on the roster row (rejected).** The obvious alternative to a composer: click the row, it expands into a form. Rejected for the reason recorded in `multi-minion-wizard-design.md` §1.5 and unchanged since — at `md:w-[42%]` the sub-resource add-forms already wrap (`flex-[1_1_220px]`, `flex: 0 1 160px`), nesting a form inside a list row costs another level of horizontal padding, and the ~76px → ~900px expand delta scroll-jumps the panel. It also would not generalise: it is tolerable for a three-field location and unusable for a monster.

**A separate "Attached" section above "Added in this mystery" (rejected).** Splitting the roster by origin makes the provenance visible for free. Rejected because origin no longer changes what you can do (Skyler's answer 6), so the split would be a distinction without a consequence — and it doubles the empty states, doubles the headers, and makes "how many locations does this mystery have?" a mental addition.

**A persistent "Attached" or "Shared" badge on the row (rejected — confirmed by Skyler 2026-09-19, OQ5).** Same reasoning: it no longer signals a capability difference, and Skyler explicitly said no warnings. The one thing it *would* still signal is that removal offers Detach — but the modal says that better, at the moment it matters. His answer was "No, don't display on the roster card"; see §2.2.

**A modal or drawer for the attach picker (rejected).** The wizard's live dossier is its core promise and a modal disconnects from it; the app's only modal is a confirm dialog. Same reasoning as the minion design's rejection of modal-per-minion.

**A "browse" panel with cards instead of a select (rejected).** Richer, and genuinely better at 12+ entities where names alone are ambiguous. Rejected as premature: `getAll()` is unpaged, current volumes are small, and the searchable select with a type sub-label covers it. Revisit if the catalogues get large — that is the same trigger as Yoshi's §8.5.

**Making `Detach` the rightmost/default button (rejected).** It is the safe action and the safe action wants to be easy. But rightmost-is-the-confirm is the shape of every other dialog in this app, and a variant-dependent rightmost meaning is worse than a slightly harder safe path. Safety is bought with initial focus instead (§8.5).

---

## 12. Questions — all answered

**No live questions remain.** Every item below is closed as of 2026-09-19 and folded into the section it affects; they are kept struck through rather than deleted so cross-references from Yoshi's doc still resolve. Two carry forward in a form that is not a question: OQ9 is Luigi's implementation call, and OQ10 is a deliberate deferral recorded in §12.1.

1. ~~**(§7.1) Should `Detach` appear even when the entity is in no *other* mystery?**~~ **Answered 2026-09-19 — yes, and you took my recommendation over your own earlier rule:** *"Sure, go ahead and offer detaching anyway. As long as the modal indicates how many other mysteries the entity is associated with, the user can make the informed decision."* Your condition is met explicitly in variant (B) — "isn't used by any other mystery" — and in variant (C), where the count is stated in the sentence above the names. See §7.1.
2. ~~**(§2.3) Should the composer collapse after saving a Location or Bystander?**~~ **Answered — "Yes, collapse after save."** All four entities, no exception. Folded into §2.3, including the accepted cost.
3. ~~**(§2.2) Locations and Bystanders move from a 44px strip to a ~76px card.**~~ **Answered — "Yes, Roster rows can grow."** Folded into §2.2.
4. ~~**(§7.2) Button labels: `Detach` / `Delete` share a prefix.**~~ **Answered — "Detach and Delete is fine. I understand the risk, but it's not a concern for me."** Recorded in §7.2 as a risk *accepted*, not absent, with the two mitigations kept on file should a misclick ever be reported.
5. ~~**(§11) Should an attached or shared entity be marked on its roster card?**~~ **Answered — "No, don't display on the roster card."** Folded into §2.2 and §11.
6. ~~**(§9.3) Should the mystery chips on an entity's edit form link to those mysteries?**~~ **Closed 2026-09-19 — no longer needs your input.** Yoshi conceded the point in rev 3, so both docs now say no: the form is often dirty, the entity detail pages carry no `CanDeactivate` guard, and a link out of a live form control is a data-loss trap. A separate read-only "Appears in: …" line remains the safe way to get the navigation later, and `hunter-draft.guard.ts` is the shipped pattern for guarding it.
7. ~~**(§10.3) The wizard fetching the full mystery list**~~ **Answered 2026-09-19 — yes:** *"Do the cheap route (fetch)."* The modal names the other mysteries. Note that this does not override your answer 2's "indicate how many": §7.1's variant (C) states the count in the sentence *and* lists the names beneath it, so a user who only wants the number never has to read the list.
8. ~~**(§8.7) Fixing `CustomSelectComponent`'s ARIA/`Escape` handling** — ride along or its own ticket?~~ **Answered — "Include Escape closes and restores focus as part of this scope."** Specified implementably in §8.7 and placed in Yoshi's Phase 3. The component's remaining ARIA gaps were not in the ask and are listed in §12.1 so they aren't mistaken for fixed.
9. **(§2.5) Should the roster card and composer shell become literal shared Angular components, or four agreed copies of one template?** **Never Skyler's to answer — this is Luigi's call at implementation time, and it is not blocking.** Recorded here rather than dropped because it determines whether "consistent" survives the *next* change: a shared component is the real guarantee but has four differing slots (badge token, secondary line, extra control, sub-panels), while four copies is what the wizard does today and is a legitimate v1. Either satisfies this design.
10. ~~**(§7.6) Should `mystery-detail`'s asset lists get a remove affordance?**~~ **Answered — "We can punt on this for now. Make note of it for things to follow up on after the final phase."** Moved to §12.1 below.

### 12.1 Follow-ups after the final phase

Skyler asked for OQ10 to be recorded for after the final phase rather than dropped, so this is its durable home. **Yoshi keeps the master follow-up list in `docs/updates/mystery-entity-linking.md`; these are the design-side items and the two lists are meant to be read together, not merged.** Items marked *(his)* live on his list and are cross-referenced here only so this doc isn't read as a complete picture.

1. **A remove affordance on `mystery-detail`'s asset lists** (from OQ10). The asymmetry worth preserving in writing: `mystery-detail` is the **only** non-wizard page with a mystery context, so it is the only place outside the wizard where `Detach` is meaningful at all — but its four asset lists (`mystery-detail.html:88/108/129/149`) are bare links with nothing to extend. That makes it the natural pair to Yoshi's Phase 5 "attach from the mystery detail page" idea, and the two should be designed together rather than separately: a page that can attach but not remove is worse than one that does neither. If and when it lands, it takes §7.1's variant (C) unchanged.
2. **The rest of `CustomSelectComponent`'s ARIA.** Out of scope of OQ8, which covered only `Escape`-closes-and-restores-focus. Still open afterwards: `role="listbox"` sits over children that are not `role="option"`, there is no `aria-activedescendant`, and there is no arrow-key navigation between options. Listed so the Phase 3 fix is not mistaken for having made this control conformant — it makes it *dismissable*, which is the part this feature depends on.
3. **An "Appears in: …" read-only links line on the entity detail pages** (from §9.3). The chips in the membership control make sharing legible but are deliberately not links. If cross-navigation is wanted later it belongs in a separate read-only line using `.entity-link--inline`, and — since these routes have no `CanDeactivate` guard — it should land with a second registration of the shipped `hunter-draft.guard.ts` pattern rather than on its own.
4. **Composer stay-open for Locations and Bystanders**, if the extra click per item proves annoying in practice (from OQ2). One line, no dependencies.
4b. **A reactive usage block in the removal modal** (from §14.1). `pendingDelete` currently snapshots its copy at open time, so a mystery list that arrives while the dialog is open never fills the block in. Holding the entity id and computing `usage`/`usageMessage`/`footnote` over the mysteries signal would let a late arrival update the dialog in place — which also removes any reason to distinguish "still checking" from "couldn't check" in copy.
5. **Relabelling `Detach`**, if a misclick against `Delete` is ever reported (from OQ4). `Unlink` is the ready alternative.
6. **`WeaponTagSelectComponent`'s stale-`computed()` defect.** Found by Toad during the Phase 2 pass and fixed in `MysterySelectComponent` only. `selectedTags` is a `computed()` reading a plain `@Input() options` field — a non-signal read never invalidates a computed, so options arriving *after* a value has been written leave the chips permanently empty. Unreachable on its current call sites (the monster and minion sub-resource forms load their options once), which is why it was left alone rather than swept in mid-phase. The fix is the eight lines already applied to `MysterySelectComponent`: back the field with a `signal` behind a setter/getter pair so no call site moves. Worth doing before any future path refreshes a tag list independently.
7. **The `errorMessage` page-wipe on the four entity detail pages** (from §9.5.3 D2). `@else if (errorMessage())` sits *ahead of* `@else if (location())`, so setting it unmounts the form and leaves nothing to retry into. Phase 2 worked around it by making every recoverable caveat toast-only, but Luigi's `runAndRefresh` adoption added a new entry point: a *refetch* failure after a successful write still reaches `error:` and wipes the page, exactly as the shipped `monster-detail` idiom does today. Pre-existing and app-wide; the sweep is the fix.
8. *(his)* **"Attach a copy"** — Option C semantics offered additively alongside Attach.
9. *(his)* **`MysteryDetailResponse` carrying ID lists rather than counts**, which item 1 above would need.

---

### Also confirmed by your answers, needing nothing further from you

- **Answer 4** (removals at next-step click) matches §7.3 as designed; it is now cited there.
- **Answer 5** (confirm minion cascade on monster delete) is the reason §7.1 now splits `usage` from `items`. Worth knowing: this **already ships** on `monsters-list.html:50-51`, which passes minion names and swaps the message. What is new is doing it in the wizard roster.
- **Answer 6** (a minion always travels with an attached monster) confirms §5's one-line blurb copy, *"A monster you attach brings its minions with it."* It also fixes a subtlety in §7.1's monster footnote: the cascade applies to **Delete only** — Detach leaves the minions alone, because they travel with the monster rather than with the membership. The footnote says so explicitly rather than implying minions die either way.

---

## 13. Components Luigi should build on

Named explicitly so nothing gets invented:

| Need | Build on | Where |
|---|---|---|
| Roster card, `Editing` state, action cluster | the shipped minion roster, lifted verbatim | `mystery-create-monster-phase.html:151-189` |
| Composer shell, header modes, footer verbs, Cancel | the shipped minion composer | `mystery-create-monster-phase.html:196-357` |
| Commit-on-Next / on-switch rule | `commitComposerIfValid()` | `mystery-create.store.ts:1003-1018` |
| Edit / remove icon buttons | `.action-btn`, `.action-btn--edit`, `.action-btn--delete` + `<app-icon name="pencil"/"trash" class="h-5 w-5" />` | `styles.css:266-280`, `icons/icon.component.ts` |
| Type badges | `bg-badge-{monster,minion,location,bystander}` + shared badge class string | `search-results.ts:81-85`, `locations-list.html:20` |
| Attach strip chrome | today's location summary row class string | `mystery-create-locations-phase.html:3` |
| Attach picker | `CustomSelectComponent` with `[searchable]="true"`, `size="compact"`, explicit `optionSubLabel`, `emptyText` | `shared/custom-select.component.ts` |
| Monster picker (locked + unlocked halves, and its error sentence) | `minion-create.html:14-30` / `minion-create.ts` | — |
| Removal confirmation | `ConfirmDeleteModalComponent`, extended with a secondary action (label input + output), a `usage` / `usageMessage` pair above the existing `message` / `items`, and `permanenceNote` renamed `footnote` and rendered unconditionally | `shared/confirm-delete-modal.component.*` |
| Cascade list in that modal (do not displace) | already shipped — minion names in `[items]` with a swapped `[message]` | `monsters-list.html:50-51` |
| Deferred-consequence copy shape | `pendingRemoveNote()` / `pendingRemoveItems()` | `mystery-create-monster-phase.ts:44-71` |
| `MysterySelectComponent` | `WeaponTagSelectComponent`, chip token swapped to `bg-badge-mystery` | `shared/weapon-tag-select.component.*` |
| Focus move after a mode change | `afterNextRender({ write })` + `tabindex="-1"` heading + `focus({ preventScroll: true })` | `wizard-layout.ts:47-60` |
| Row entrance motion | the existing `fadeSlideIn` keyframe + its reduced-motion guard | `wizard-layout.scss` |
| Dossier one-expanded-entry pattern | `ng-template` + `ngTemplateOutlet` in the roster slot | `mystery-create-dossier.html:133-135` |
| Button weights in the wizard column | outline-accent for every non-`Next` action; `Next →` stays the only filled accent control | `mystery-create.html:32-35`, `mystery-create-monster-phase.html:64` |

There is no new visual language in this proposal. Every class string above already ships.

---

## 14. Phase 4 design review (ceremony, 2026-09-20)

**Facilitator:** Rosalina. **Participants:** Luigi, Peach (acceptance criteria, in the architecture doc). **Scope under review:** attach an existing Location or Bystander, re-edit an already-associated one, remove one via the Detach/Delete modal. Monsters are Phase 5.

Verified by reading the Phase 3 code as committed (`c9d554a`), not the plan for it.

### 14.1 Ruling — the in-flight mystery lookup keeps one string

Decoupling the list pages' loads created a third state §7.7 didn't name: the mystery lookup is neither failed nor available but **still in flight**. Both currently say *"Couldn't check which mysteries use this location."* Luigi flagged it rather than inventing a string. **Ruling: keep one string. Do not add "Still checking…".** Four reasons, in descending weight:

1. **A second string would be a permanently-stuck progress message, not a progress message.** `pendingDelete` is a **snapshot** captured at `requestDelete` (`locations-list.ts:87-107`) — the copy is computed once, at open time, and does not recompute when the mystery list lands. So a dialog that said "Still checking…" would go on saying it forever, with the answer sitting in a signal one layer away. That is worse than the current honest sentence.
2. **The user-facing consequence is identical** — no verified usage, cancel and retry — so a second string is a distinction that leads to no different decision.
3. **"Still checking…" implies it will resolve while you watch,** which invites waiting. If the request has already failed, that is simply false, and the component cannot tell the two apart anyway: `mysteriesAvailable` is one boolean that starts `false`, and the error branch sets it `false` again (`:83`). The state doesn't exist in the code either, only in the timeline.
4. The window is small — the dialog is normally opened well after the page settled.

**If we ever want the distinction, the right fix is not a string.** It is to make the usage block **reactive**: hold the entity id in `pendingDelete` and compute `usage`/`usageMessage`/`footnote` from a `computed` over the mysteries signal, so a late arrival simply fills the block in while the dialog is open. At that point no in-flight copy is needed, because the block updates instead of narrating. Recorded in §12.1 as a follow-up, not scheduled.

> **The general rule, since I have now hit it twice:** a state that exists in the implementation does not earn copy unless it changes what the user should *do*. This is the same error as the "loaded versus committed" rule in §10.1 — implementation structure leaking into interaction semantics.

### 14.2 Do the Phase 4 variants still compose with the as-built modal? Yes — with four bindings Luigi must get explicitly right

They compose. The three-button shape, the focus restore and the Escape nesting all survive. But the as-built component has two defaults and one DOM-derived behaviour that make Phase 4 easy to get subtly wrong:

**(a) `message` still defaults to `'This cannot be undone.'` — the wizard must pass `message=""` explicitly.** This is the §7.1 footnote trap pointed the other way. `footnote`'s default became `''`, but **`message`'s did not** (`confirm-delete-modal.component.ts:47`). A Location or Bystander removal has no cascade, so the natural thing is to pass no `message` at all — and that silently renders *"This cannot be undone."* in a dialog where §7.3 says it is **false**, because removal is deferred to the next phase transition. Pass `message=""`. Worth a spec assertion, not just care.

**(b) The `verb` / `confirmLabel` split differs between the A variants and B/C.** `confirmLabel` falls back to `verb`, so:

| Variant | `verb` | `confirmLabel` | `secondaryLabel` | `footnote` | Title / buttons |
|---|---|---|---|---|---|
| (A1) never persisted | `Remove` | *(unset)* | *(unset)* | `''` | `Remove "…"?` · Cancel · **Remove** |
| (A2) attached this session | `Remove` | *(unset)* | *(unset)* | `''` | `Remove "…"?` · Cancel · **Remove** |
| (B) persisted, no other mysteries | `Remove` | `Delete` | `Detach` | deferral clause | `Remove "…"?` · Cancel · **Detach** · **Delete** |
| (C) persisted, shared | `Remove` | `Delete` | `Detach` | deferral clause | `Remove "…"?` · Cancel · **Detach** · **Delete** |

The title stays "Remove" in all four — the user is removing it from the mystery — while the destructive button says what it actually does. That is precisely what `confirmLabel` was added for, and the two A variants are the ones that must *not* set it.

**(b2) Two corrections from Peach's acceptance criteria landed in §7.1 after this review and change what you build here.** Both are small, and both are easy to get wrong in the same file:

- **The variant predicate is the baseline, not `id`** (G3). `id !== null` is true the instant an entity is attached, so keying on it offers `Delete` — permanent catalogue destruction — to a user undoing a mis-click. The phase component needs *"is this membership in the phase baseline"*, and **that predicate should be the same one Yoshi's submit diff uses**, not a second implementation of the same question. Confirm the shape with him before wiring it; if the diff ends up keyed differently, the fact still has to be exposed to the component.
- **The footnote's closing clause branches on the last phase** (G2). Bystanders is `lastPhaseIndex` and its button says **Finish**, so "continue to the next step" is false there. Derive from `store.currentPhase() === store.lastPhaseIndex` rather than hardcoding per component, and put the wording in one helper that the minion phase's existing note can also read.

**(c) §2.1's section order is now load-bearing for focus, not just for reading.**

**(c) §2.1's section order is now load-bearing for focus, not just for reading.** `focusSurroundingSurface()` (`:248-257`) restores focus after a confirmed removal by taking the modal host's `parentElement` and focusing **the first focus stop inside it**. With §2.1's order — roster → attach strip → composer — that is the first roster card's pencil, which is correct. **If the attach strip were moved above the roster, every confirmed removal would dump focus into the attach select instead.** So: keep the order, and put the `<app-confirm-delete-modal>` at the end of the phase template so its parent is the phase root. Two edge cases both land well: removing the last row leaves no roster buttons, so focus goes to the attach select or — when the catalogue is empty and the strip is hidden — to the auto-opened composer's first field.

**(d) The roster `@for` must track `localKey`, never `$index`.** `LocationDraft` and `BystanderDraft` do not have one yet; `createDraftKey()` already takes a prefix (`mystery-create.store.ts:102`), so this is `createDraftKey('location')`. Beyond §10.2's original reasons there is now a sharper one: the modal restores focus to `lastFocusedOutside` **if `opener?.isConnected`** (`:234`). Under `track $index` Angular recycles DOM nodes, so after removing a row the opener trash button is still connected — but it now belongs to a **different entity**, and focus silently restores onto the wrong row's control with no error anywhere. Stable keys are what make that check mean what it says.

Also confirmed unchanged by the as-built: variant A needs no `footnote` (default is `''`); the `usage`/`usageMessage` pair carries the wizard's "**other** mysteries" wording, which `shared/mystery-usage.ts` deliberately does **not** provide — its header says so explicitly, and Phase 4 adds the wizard wording rather than reusing the list-page functions.

**One Phase 3 mechanism change Phase 4 must not regress:** the dialog's Escape/Tab handler moved from the backdrop element to `document` (`:177`). The reason is worth knowing — the dialog's own title and padding are not focusable, so a single stray click on them dropped `activeElement` to `<body>`, and a keydown on `<body>` never propagates *down* into a backdrop listener, so Escape silently died after one click on every call site. The §8.7 nesting property is unaffected: `CustomSelectComponent` still `stopPropagation()`s while its panel is open, halting the event at the select's host so it never reaches `document` either. First Escape closes the dropdown, second closes the dialog. Phase 4 puts a select and a dialog on the same screen for the first time in the wizard, so this is the phase that will actually exercise it.

### 14.3 Open risk on Phase 4 — the composer heading may not announce

**Closed by browser verification (`a063449`):** all four wizard focus destinations work in real Chromium — pencil → the heading reading `Editing "…"`, `+ Add Another Minion` → the same heading reading `Add a Minion`, and both `Save` and `Cancel` → back to `+ Add Another Minion`. Toad also **retracted his earlier finding** that a confirmed delete orphans focus: it does not, it lands on the next row's pencil.

**Still open, and now an explicit Phase 4 risk rather than an ambient one:** nobody has confirmed with an actual screen reader that **focusing the composer heading announces its text**. §8 item 1 rests entirely on that — the whole reason focus goes to the heading rather than the first field is that the heading reads "Editing “Sheriff Dalton”" and therefore announces the mode change *without* needing `aria-live`. If a `tabindex="-1"` heading is instead swallowed as a non-interactive focus target, the mode change is announced nowhere and a screen-reader user cannot tell create from edit.

> **Decision rule waived by Skyler, 2026-09-20.** The rule below fired as designed — Phase 4 completed with the announcement still unverified — and Skyler waived it: *"I am unconcerned at this time about the screen-reader support so we can ignore that."* So the `sr-only` status region does **not** ship as a Phase 4 fallback, and Phase 5 should not re-raise it as a blocker. The risk is unchanged and still real; what changed is that it is accepted rather than insured against. §8 items 2 and 3 stay in §12.1 as follow-ups. Recorded here rather than by deleting the rule, because the rule's reasoning is still sound and a future reader should see that it was overridden deliberately rather than forgotten.

Phase 4 replicates this composer into two more phases, which triples the exposure. **Decision rule, so it does not drift:** if the announcement is still unverified when Phase 4 is otherwise complete, **ship §8 item 2 (the `sr-only` `aria-live="polite"` status region) regardless** rather than carrying the risk into Phase 5. It is one element and three strings per phase, it is already specified, and it makes the announcement question moot instead of load-bearing. Verifying is cheaper than insuring, but insuring is cheap.

### 14.4 One assertion shape worth protecting (from Peach's A6)

Primarily Toad's, recorded here because the wording originates in my §5.2/§10.1 framing and a paraphrase of it would fail a correct implementation.

**A6 asserts the attached entity's field values, not the absence of a `PUT`.** In Phase 4 a no-op `PUT` of identical values is **expected and correct** — the dirty check that suppresses it is Phase 5 and monsters-only (§10.1: write amplification only bites for monsters, where delete-all/recreate-all re-keys eight sub-resource collections). The architecture doc's Toad line, "confirm its own fields are unchanged if untouched," is accurate but sits one paraphrase away from "confirm no `PUT` is issued" — which would red-flag a Phase 4 implementation that is doing exactly what this design asks of it.

The load-bearing regression for Phase 4 is the one already stated in §5.2: **attach an existing location, press Next, and confirm the location's own fields are byte-for-byte what they were.** That is a value assertion. Keep it one.

### 14.5 What Phase 4 inherits and must not re-litigate

Settled and not open for rediscovery during implementation: the roster card markup and `Editing` state (§2.2), the composer's three mode signals (§2.3), collapse-after-save for all four entities (OQ2), the strip-to-card upgrade (OQ3), `Detach`/`Delete` labels (OQ4), no sharing marker on the card (OQ5), and the attach strip's commit-on-pick behaviour with no Add button (§3). Yoshi's baseline-snapshot diff (§10.1) is the store-side contract; nothing in this section depends on how it is implemented.

---

## 15. Phase 4 QA rulings (2026-09-20)

Two findings from Toad's Phase 4 pass. Both change what Luigi builds.

### 15.1 The wizard asserts "isn't used by any other mystery" when only the *names* failed to load

**This is a production bug and the copy fix is not the one it looks like.**

Repro: `getMysteries()` errors (swallowed at `mystery-create.store.ts:854`), trash a location that is in two other mysteries, and the dialog says *"This location isn't used by any other mystery"* — the opposite of the truth, on the sentence the Detach-vs-Delete decision is made from, for an irreversible action.

**The important detail, which reframes the whole question:** `pendingRemoveUsage` is `resolveMysteryNames(otherIds, store.mysteries())`, and `otherIds` comes from **the draft's own `mysteryIds`** (`mystery-create-locations-phase.ts:71-73`). That array is populated at attach or hydrate and does not depend on `getMysteries()` at all. So:

| What | Source | Reliable when `getMysteries()` fails? |
|---|---|---|
| **How many** other mysteries | `draft.mysteryIds`, minus the current one | **Yes — always** |
| **Which** mysteries, by name | `resolveMysteryNames(…, mysteries())` | No |

**The count was never the unreliable part.** Reading `usage.length` as the count conflates "no other mysteries" with "no names resolved", and those are different facts from different sources. So the fix is not to admit ignorance — it is to **stop deriving the count from the names**:

```
otherCount  = otherIds.length                    ← decides the sentence and the buttons
usage       = resolveMysteryNames(otherIds, …)   ← decides only whether bullets render
```

**Copy.** Three states, keyed on `otherCount` and on whether names resolved:

| State | `usageMessage` | `usage` |
|---|---|---|
| `otherCount === 0` | `This location isn't used by any other mystery.` | `[]` |
| `otherCount > 0`, names resolved | `This location is also used by 2 other mysteries:` | names |
| `otherCount > 0`, names missing | `This location is also used by 2 other mysteries. Their names couldn't be loaded.` | `[]` |

Note the punctuation carries weight: the colon promises a list, so the names-missing variant must end in a full stop instead. A trailing colon above an empty block is its own small lie.

**Buttons: keep all three, unchanged.** The question "if the count can't be trusted, is the three-button row still right?" dissolves once the count is sourced correctly — **the count can be trusted, and the count is the only thing the Detach-vs-Delete choice needs.** Names are colour: they help a user recognise *which* mysteries, but the decision is "is this used elsewhere, yes or no," and that is answered reliably. Degrading to two buttons would remove the safe option precisely when the user has least information, which is backwards.

**One string, not two — and for a different reason than the list pages.** §14.1 ruled against a "Still checking…" state because `pendingDelete` snapshots its copy at open time, so the message could never progress. **That reasoning does not transfer**: the wizard's copy is a `computed`, so a late arrival fills the names in while the dialog is open. The wizard reason is simpler and stronger: **the names are supplementary, not decisional.** The user can act correctly on the count alone, so a "loading names…" state would invite waiting for information they do not need — and if the names do arrive, the computed already renders them with no copy needed. The best in-flight behaviour here is the one that says nothing and fills in.

> Recording this explicitly so nobody generalises the wrong rule: **the list-page and wizard rulings agree on the outcome and disagree on the reason.** One string in both cases; snapshot-can't-progress there, supplementary-not-decisional here.

**Consistency follow-up, recommended for the same change set.** The list pages have the same `mysteryIds` available and also derive their count from resolved names, guarding with a coarse `mysteriesAvailable` boolean that collapses to *"Couldn't check which mysteries use this location."* Under the insight above they could say *"used by 2 mysteries. Their names couldn't be loaded."* — strictly more useful, and from data they already hold. Leaving it produces two surfaces making **different claims from identical data**, which is the same "two modals that disagree" problem §7.5 used to argue for doing the sweep in one change set. Same shape, three call sites, and `mysteryUsageUnavailableMessage` stays for the genuinely-unknowable case. If it doesn't ride along, it belongs in §12.1.

### 15.2 R5 — attach leaves the composer open. It is a bug, but the obvious fix is worse

`attachLocation`/`attachBystander` don't re-derive composer-open, so in create mode the first attach leaves a non-empty roster *and* an open composer. §2.3's rule is stated as a function of roster emptiness, so strictly the composer should collapse — and Toad is right that the state was never intended.

**But "collapse on attach" unconditionally would destroy user input.** Consider the likely flow: a user starts typing *"the old mill"* into the composer, realises they already made one, and picks it from the attach strip. Collapsing would silently discard what they typed. That is a worse bug than the one being fixed, and it violates the rule the composer has followed since the minion work — **nothing discards the composer's contents implicitly** (which is why `commitComposerIfValid` exists rather than a discard-confirmation modal).

**Ruling: attach re-derives composer-open, but only when the composer holds nothing.**

- Composer open and **untouched** → collapse to `+ Add Another {Noun}`. The roster is no longer empty, so §2.3's rule applies and the ambiguity of two live "add" affordances goes away.
- Composer open and **dirty** → leave it exactly as it is. The user's work outranks the tidiness rule.
- Composer already collapsed → no change.

The dirtiness test is the one the composer already owns for deciding whether `Next` may proceed; reuse it rather than inventing a second notion of "empty".

**No focus move.** §8.6's contract fires when *the focused element unmounts*; here focus is in the attach select and stays there, which is correct for attaching several in a row. The composer that collapses never had focus. Do not add an `afterNextRender` focus call to this path.

**Edit mode is unaffected** and this explains why Toad saw it only in create mode: hydration leaves the roster non-empty, so the composer starts collapsed and there is nothing to re-derive.

---

## 16. Phase 5 rulings — a monster is no longer required (2026-09-20)

Skyler: *"Monster should not be required for mystery wizard flow."* Today `validateCurrentStep` hard-blocks phase 1 / step 0 on `monsterForm.invalid` (`mystery-create.store.ts:1656-1659`), and the form requires name, type and archetype. That check goes. An empty monster roster must advance, and a mystery must be saveable with zero monsters.

### 16.1 The empty state is the ordinary one — the orientation goes in the blurb

Two things are being asked at once and they want different homes.

**Empty state: identical to Locations and Bystanders, no special pleading.**

```html
<p class="text-muted text-sm italic">No monsters added yet.</p>
```

**Orientation: the blurb, which is the wizard's existing mechanism for exactly this.** `stepBlurb()['1-0']` is currently all imperatives — *"Give it a name… Choose a monster type…"* — which reads as mandatory and will be wrong the moment the block is removed. It needs the same treatment `1-1` already got for minions. Append:

> Most mysteries have one monster, though you can add several — or none, if the threat isn't a creature.

The imperatives above it then describe the **composer** ("when you do add one, here's what to fill in") rather than the phase, which is the same relationship `2-0` and `3-0` already have with their own volume guidance.

**Why the blurb and not the empty state, stated as a rule:** the blurb is *orientation* — what this step is for, what's typical. The empty state is *status* — what's here right now. Putting the norm in both would say it twice on one screen, and a hint repeated is a nag, which is where a nudge starts reading as a warning. One statement, in the always-visible position at the top of the step.

### 16.2 Yes to the nudge — and it is not a warning under decision 4

Ruling: **the blurb sentence above is the nudge, and there is nothing else.** No confirmation on Finish, no "this mystery has no monster" band, no asterisk, no tracker gating.

The principle that makes this consistent with decision 4 rather than an exception to it: **decision 4 governs verdicts on choices already made; this is orientation offered before any choice exists.** At the moment the blurb is read the user has decided nothing — it is a label on a blank slate, not a comment on their work.

Two things keep it on the right side of that line, and both are load-bearing:

1. **It states a norm, in a voice this app already uses.** `2-0` says *"Most mysteries have 4–6 core locations"* and `3-0` *"Most mysteries have 5–10 bystanders."* Monsters getting the same treatment is the consistent choice; *not* having it is the anomaly.
2. **It gives zero a reason** — *"if the threat isn't a creature."* A haunted place, a curse, a conspiracy are real MotW mysteries. Legitimising the empty case with an example is what turns it from "you forgot something" into "this is a supported option," and that is the whole difference between a nudge and a warning.

**Field-level `required` stays; phase-level required goes.** The composer's Name, Type and Archetype keep their `*` and their inline errors — if you start a monster you must finish it, which is the standing composer rule (`commitComposerIfValid`) and not a gate on the phase. The distinction matters because deleting the `validateCurrentStep` branch must not also strip the validators.

**Do not gate the phase-1 tracker dot on monster count.** Completeness is set on submit; requiring a monster for the dot would reintroduce "required" through the back door, visibly.

### 16.3 Read surfaces — verified, no design needed

Both already handle it, and neither needs a change:

| Surface | With zero monsters | Verdict |
|---|---|---|
| `mystery-detail.html:91-92` | `@if (pureMonsters().length === 0) { <p>No monsters.</p> }` | **Already correct** — same shape as its Minions, Locations and Bystanders siblings |
| `mystery-create-dossier.html:56` | Guard is `currentPhase() >= 1 && monsterPreview().name`, so the section simply doesn't render | **Correct, and the established dossier convention** — Locations (`:223`) and Bystanders (`:239`) also only appear once non-empty |

The dossier's guard will need widening to `monsterDrafts().length > 0 || monsterPreview().name` under the roster, mirroring the minion section at `:125`. That is a roster change, not an empty-state change: absence stays the right rendering for zero, because the dossier's job is "what you've built so far" and sections appear as you build.

### 16.4 Minion removal — variant (E), and the predicate is *not* `membershipPersisted`

Minions join the disposition drain, so the minion phase's modal moves onto the `confirmLabel` shape the other collections use. **It never gets a `secondaryLabel`:** a minion has no mystery membership, so there is nothing to detach.

**The predicate first, because it is where the bug would be.** §7.1 keys on *"is this mystery's membership persisted"*. A minion has no membership — **the row itself is the thing** — so the question to ask of a minion is *"is this row persisted"*. Read literally, "is the membership persisted" is false for **every** minion, which would classify every minion removal as a local discard and silently stop deleting them. **One name for two referents was the defect.**

> **Reconciled 2026-09-20 with what shipped (§7.7b / `persistedForRemoval`). My diagnosis stood; my remedy was the wrong one, and I'm withdrawing it.**
>
> I asked for a **separate predicate** for minions, keyed on `id !== null`. What shipped is one predicate for all four collections, renamed `persistedForRemoval` and read from the baseline. **That is better, and Luigi's reason is the one that decides it — it is a UX argument, and I should own it rather than concede it as architecture:**
>
> **The modal's confirm label is a promise about what is going to happen.** `Delete` promises destruction; a bare `Remove` promises a local discard. The dialog and the drain are answering the same question about the same row, so a second predicate is a way for them to disagree — and the failure is symmetric and silent in both directions. Dialog says `Delete`, drain classifies it a local discard: the user believes the minion is gone and it reappears next visit. Dialog says `Remove`, drain deletes: the user believes they undid a click and the entity is destroyed. **Either way the modal lied about its own button**, which is far worse than the naming untidiness I was trying to fix.
>
> My actual objection was to the *name*, and renaming fixed it: `persistedForRemoval` names the **question** ("would removing this draft change anything on the server?") rather than the mechanism, and that question genuinely is the same for all four collections even though the baseline holds memberships for three of them and rows for the fourth.
>
> **One argument neither of us made, which settles it beyond preference:** I justified `id !== null` on "minions are never attached" — but that is a *contingent* fact, protected only by §2.5 and §6.3 being obeyed. Predicating a destructive button on a convention is weaker than predicating it on data. If minion attach were ever added, `id !== null` would silently start offering `Delete` for a mis-clicked attach — **the exact §7.1 bug, reintroduced in the one collection where I had argued the shortcut was safe.** The baseline form degrades gracefully there; mine does not.

**The protective note still matters — it belongs to the *question*, not to the implementation.** A reviewer who remembers "we decided `id !== null` is dangerous" needs to know why the minion case looked different:

> **For minions the two forms agree**, because minions are never attached (§2.5 — there is no attach strip on that step and there never will be), so an id can only become non-null by being saved, and the store sets `existingMinionIds` from exactly those saves and from hydration. **The answer is read from the baseline anyway**, so that all four collections resolve the same way and no path can set an id without recording the baseline and diverge. Observational identity is the reason the minion case is *safe*, not a licence to implement it differently.

**Variants.** Two, both without Detach:

**(A1-minion) never saved** — `id === null`. Local discard.

> **Remove “Grave-Wight”?**
> This minion hasn't been saved yet. Removing it discards what you typed, including:
> • 2 attacks
> • 1 power
> `[ Cancel ]  [ Remove ]`

`verb="Remove"`, **no `confirmLabel`**, no `secondaryLabel`, `usageMessage=""`, `usage=[]`, `footnote=""`. With no sub-resources the lead-in drops its last clause and ends *"…discards what you typed."*

**(E) persisted** — `id !== null`. A real `DELETE` at submit.

> **Remove “Grave-Wight”?**
> Deleting it also removes:
> • 2 attacks
> • 1 power
> *The minion will be deleted when you continue to the next step.*
> `[ Cancel ]  [ Delete ]`

`verb="Remove"`, **`confirmLabel="Delete"`**, no `secondaryLabel`, `usageMessage=""`, `usage=[]`. With no sub-resources, `message=""` and the dialog is title + footnote — clear and sufficient, so don't invent filler.

Three notes on the copy:

- **The title stays "Remove" in both**, with the button saying what actually happens. Same split as (B)/(C), same reason: the user's action is removing it from the roster; the consequence is what the button names.
- **`message` keeps its shipped cascade-lead-in meaning** and is worded to introduce the list that follows. Resist putting the situational sentence in `usageMessage` — it renders in the right place but the name would then mean "usage" on three surfaces and "whatever sentence we had spare" on this one.
- **The deferral clause comes from `deferredChangeTail()`** (§15 / G2), not a literal. Phase 1 is never last, so it always resolves to *"when you continue to the next step"* today — derive it anyway, for the same reason G2 gave: the phase order is being changed by this very feature.

### 16.5 Beyond copy — what Luigi needs

- Remove the `phase === 1 && step === 0` branch of `validateCurrentStep` **without** touching the composer's validators (§16.2).
- A minion-specific persistence predicate, not a widened `membershipPersisted` (§16.4).
- Minions added to the pending-removal drain, with `action: 'delete'` only — there is no `'detach'` for a minion, and the type should say so rather than accepting a value it will never receive.
- The reparent call is a **dedicated verb**, not a field on the minion `PUT` (§6). Wire the picker to it.
- The zero-monster minion state (§6, *"Add a monster first — minions belong to a monster."*) stops being an edge case and becomes a reachable path. The copy stands; keep it in the ordinary `text-muted text-sm italic` empty-state treatment so it reads as a state, not an error.

### 16.6 On Peach's `5b-O*` pairing — agreed, and the pairing is necessary rather than tidy

She tests the blurb nudge and the field-versus-phase validator split as a pair because the two changes look identical from a single test. **That is exactly right and it is the concrete form of §16.2's warning.** Worth stating why, so nobody later "simplifies" the pair back into one test: stripping the composer's validators produces a wizard that **advances** — which looks like success. A test asserting only *"Next advances with an empty roster"* passes in both the correct world and the broken one. It takes the second assertion — that a **started** monster still blocks on its own required fields — to tell them apart. No change to my ruling; her reading is the one I intended.

---

## 17. Phase 5b ruling — attaching a monster cannot be instant, and the roster must not show a half-monster (2026-09-20)

`MonsterListItemResponse` carries `attackCount`/`powerCount`/… and **no minions** (`core/models.ts:191-205`). `LocationListItemResponse` carries everything a `LocationDraft` needs, which is why `attachLocation` builds its draft straight from the picked option with no request at all (`mystery-create.store.ts:1269-1287`). A monster needs `getById` + `getByMonster` + a `getById` per minion — **1+1+N** — before the card has anything real to show.

### 17.1 Ruling: hold the card, move the feedback into the strip

**I'm adopting Peach's position — nothing enters the roster until its subtree is in hand — but the reason that decides it is not "don't show a half-monster."** It is this:

> **A roster row must be a complete draft. Every consumer depends on it.**

The dossier renders a block per monster, the minion composer's parent picker offers roster monsters, the removal modal discloses what a row takes with it, and the submit diff reads a row's collections as the user's intent. A "still loading" row forces a *what if this is incomplete* branch into **all four**, and one of them silently produces real destruction (§17.4). Making the roster's completeness an invariant deletes four branches instead of adding them.

**This is also the §11 answer, not a departure from it.** §11 rejected splitting the roster by origin because origin should not change what a row can do. A loading row is a row that can't be edited, can't meaningfully be removed, and can't be picked as a minion's parent — **a second class of roster row, which is the exact thing §11 refused.** Holding avoids creating one.

**And commit-on-pick survives.** §3's rejection of a browse panel and a modal was about space, about staying connected to the live dossier, and about not adding a confirm step — none of which this touches. What §3 was really protecting is **feedback**, not literal zero latency. So the feedback moves to the control the user is looking at:

| State | Attach strip | Roster |
|---|---|---|
| idle | `Search your monsters…` | — |
| **picking** | disabled, showing the picked name, `<app-icon name="spinner" class="h-4 w-4 shrink-0" />` + `Loading “The Hollow Man”…` | **unchanged** |
| success | resets to placeholder, option now filtered out | card appears, complete |
| failure | resets and re-enables, inline `text-danger text-sm` beneath | **unchanged** |

The busy treatment copies the shipped one at `app.html:47-49` — spinner glyph plus a text label inside a disabled control. *(Pre-existing nit, flagged not fixed: neither shipped call site adds a rotation class and `icon-spinner` has no animation of its own, so the app's spinners are currently static. If Luigi adds `animate-spin` here, add it at all three sites rather than leaving them inconsistent.)*

### 17.2 Failure copy, and the structural fix that outlives it

> `Couldn't load “The Hollow Man”. Try again.`

Inline in the strip, `text-danger text-sm`, cleared by the next successful pick. **Local to the control that failed** — not the wizard's footer error band, which belongs to submit failures and sits a scroll away from the action that caused this. The monster stays in the options list because it was never attached, so retry is simply picking it again; no separate retry affordance.

**The half-monster of state 2 cannot occur, by construction** — nothing entered the roster. But one rule should outlive this specific fix:

> **The roster card's counts must be derived from the draft's own collections, never from `MonsterListItemResponse`'s `attackCount`/`powerCount`/….**

Otherwise the card and the composer read two different sources that agree only by coincidence, and "card says `Attacks: 4`, composer shows none" becomes reachable again by any future path that loads them separately. This is the same defect shape as §15.1, where a count derived from resolved *names* silently answered a question the *ids* already answered. **A summary and its detail must come from one source, not two that usually match.**

### 17.3 During the fetch, `Next` is disabled

Recommended, with the cheaper alternative named. If the user presses `Next` mid-fetch, the attach has not happened and their explicit action silently evaporates — the phase submits and the monster simply isn't there. Add the in-flight attach to the existing disabled binding alongside `store.isSubmitting()` (`mystery-create.html:33`); it is one more condition on a control that already has this behaviour, and the window is short.

The cheaper fallback is to let `Next` win and abandon the attach. I don't recommend it: the cost of the guard is one boolean, and the failure it prevents is the user's deliberate action disappearing with no trace.

### 17.4 What this gives Yoshi — an invariant, stated so it can't erode

State 3 cannot occur under this ruling, but the reason must be written down as a guarantee rather than left as an accident of the current implementation:

> **The monster roster contains only complete drafts. The submit diff will never see a partially-loaded monster.**

That is worth coordinating with him explicitly, because it **simplifies** his diff — no incomplete-draft guard is needed — and a simplification that rests on an unstated invariant is exactly what a later "let's make attach feel snappier, show the card immediately" change would silently break. If the invariant is recorded on both sides, that change gets caught in review instead of in production. His team's finding that this is the only path producing genuine sub-resource destruction rather than harmless churn is the reason it deserves that weight.

Two things for him specifically, beyond the data flow he is already deciding:

1. **Where the fan-out lives.** The strip's busy state is per-phase view state, but the fetch populates a store draft. Whichever owns it, the roster must not be written until all 1+1+N responses have resolved — a partial write is the half-monster by another route.
2. **Failure must leave no trace.** No orphan draft, no half-populated baseline, and the monster still present in `attachableMonsters` so retry works. A baseline written for a monster whose contents never arrived is worse than no attach at all, because it would make the next diff treat "nothing" as the user's intent.

### 17.5 What changes in the attach affordance — less than it sounds

**The visual vocabulary is unchanged.** Same strip, same position above the composer (§14.2(c) still governs focus), same single-select, same commit-on-pick, same exclusion of roster members, same hide-when-catalogue-empty rule. **One control gains two transient states — busy and error — and both are monsters-only.**

Locations and Bystanders do **not** get them; they have no fetch, and a state that can never trigger is dead code. If the markup is shared, the two states should be driven by inputs those phases simply never set.
