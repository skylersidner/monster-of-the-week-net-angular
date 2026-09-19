# Mystery List/Detail — Wizard Link (Wizard Hat icon)

**Prepared by:** Rosalina (Designer)
**Requested by:** Skyler Sidner
**Date:** 2026-09-18 (multiple revisions same day — see section-by-section status below)
**Status:** The mysteries-**list** row swap (pencil → `icon-wizard`) shipped; Skyler rejected the first (filled) rendering, Luigi's outline redraw (Sections 5/6) was itself superseded before Skyler saw it — **Section 7 (+ its addendum) is the current source of truth for what art is actually live**, and even that's a description, not the file itself: always verify `icon-sprite.component.ts`'s `#icon-wizard` symbol directly rather than trusting a path copied into this doc. **Section 8 is the current open item** — a second placement of the same `icon-wizard` symbol on the mystery-**detail** page, advisory, not yet implemented. Sections 1–6 are kept for the icon-selection record only; read the strikethroughs/callouts, don't take the original prose at face value.

`docs/design/` did not exist before this doc — no existing "design notes" folder was found under `docs/` (icon/visual work has previously lived as narrative decision docs in `.squad/decisions/inbox/` and as an implementation plan at `docs/updates/svg-symbol-icons.md`). Created `docs/design/` as the natural home for future icon/visual-concept docs, parallel to `docs/theming/`.

---

## Correction (2026-09-18, second revision): I misread the icon family — trash/pencil are outline drawings, not filled silhouettes

Section 1 originally classified `icon-trash` and `icon-pencil` as "solid filled silhouettes" on the strength of their `fill="currentColor"` attribute, and told Luigi to match that with a filled Wizard Hat. **That was a mistake — I matched the attribute and missed the drawing.** Skyler rejected the shipped result on sight: "the other iconography is all outline-driven and a little cartoony/low-fidelity... the only icon that is filled in is the primary one used as the favicon."

Looking again at the actual path geometry in `icon-sprite.component.ts`, not just the presentational attribute: `icon-trash`'s path draws a hollow lid outline and a hollow tapered body with open interior counters; `icon-pencil`'s path (`fill-rule="evenodd"`) draws a document outline with hollow ruled lines and an open page-fold corner cut out of the fill. Both are **outline drawings expressed as filled paths with counters cut out of them** — a legitimate SVG technique for drawing an outline shape without a separate `stroke`, but they read as outline icons, not filled ones. `fill="currentColor"` being present doesn't mean "this is a solid silhouette"; it can just as easily mean "this shape's outline is drawn via a filled ring."

The app's actual dominant, unambiguous convention is explicit stroke-based outline: every `icon-nav-*` symbol, every `icon-mystery-*` symbol, and `icon-close`/`icon-menu`/`icon-plus` are `viewBox="0 0 24 24" fill="none" stroke="currentColor"` (`stroke-width="1.8"` for nav/mystery-section, `"2"` for close/menu/plus). That — not `icon-trash`/`icon-pencil` — is the system to match. `icon-trash`/`icon-pencil` also carry odd, non-standard viewBoxes (`0 40 32 32` and `0 0 100 100` respectively, versus everything else's clean `0 0 24 24`), which points to them having been imported from somewhere rather than authored to this app's own system — another reason not to treat them as the reference. **The only genuinely filled icon in the sprite is `icon-logo`** (the favicon/brand mark), and it's filled with hardcoded brand hex colors as a deliberate, one-off exception (`.squad/decisions/inbox/luigi-favicon-logo-mark.md`) — not a second "filled icon family" to draw from.

Net effect: Section 1's family table below is corrected inline (struck through, not deleted). Section 2's "solid silhouette" constraint is superseded. Concept A's filled path (Section 3) is superseded by a redrawn outline version in **Section 5**, which is now the live recommendation.

---

## Corrected premise: this is a relabel, not a new row action

`mysteries-list.html`'s existing pencil icon **already routes into the mystery wizard**: `[routerLink]="['/mysteries', mystery.id, 'edit']"` resolves to `MYSTERIES_ROUTES`'s `:id/edit` path, which loads `MysteryCreateComponent` — the exact same component used for `/mysteries/create`. There is no separate, non-wizard "edit" surface for mysteries; edit *is* the wizard, reused.

This doc originally treated that finding as an open question — whether Skyler wanted a second, distinct entry point alongside the pencil. Skyler has since confirmed the finding and resolved the question: **no new button.** The ask was always this one link; the pencil glyph just wasn't communicating that clicking it opens the multi-phase wizard. The fix is a straight icon swap on the existing `action-btn action-btn--edit` link — same button, same `:id/edit` destination, same row position, same `.action-btn--edit` indigo hover treatment. Only the glyph (`<app-icon name="pencil">` → `<app-icon name="wizard-hat">`, or whatever `IconName` Luigi lands on) and the `title` attribute change.

Because this is a swap and not an addition, the earlier "give it its own `.action-btn--wizard` purple hover modifier" recommendation (section 2, struck through below) **is not being adopted**. The button's identity and destination are unchanged — it's still "the edit action" — so it keeps `action-btn--edit`'s existing indigo hover rather than gaining a new color identity.

---

## 1. The icon system already in place

Verified by reading `shared/icons/icon-sprite.component.ts`, `shared/icons/icon.component.ts`, `shared/domain-icon.component.ts`, `features/mysteries/shared/mystery-section-icon.ts`, and grepping `<svg`/`mat-icon`/`icon` across all of `src/app`. One sprite, three consumption conventions layered on top of it (`docs/updates/svg-symbol-icons.md` is the canonical reference — still accurate, Phase 4 is complete):

| Family | Symbol ID prefix | Consumed via | `viewBox` | fill/stroke | stroke-width | Used for |
|---|---|---|---|---|---|---|
| **Generic action/chrome** | `icon-{name}` (unprefixed) | `<app-icon name="...">` | **per-icon, not uniform** (`icon-trash` is `0 40 32 32`, `icon-pencil` is `0 0 100 100`, `icon-close`/`menu`/`plus` are `0 0 24 24`, `icon-search` is `0 0 20 20`) | ~~**mixed** — `trash`/`pencil`/`search` are solid `fill="currentColor"` silhouettes; `close`/`menu`/`plus` are `stroke="currentColor"` line icons~~ **Corrected:** `trash`/`pencil`/`search` all carry `fill="currentColor"`, but their path geometry draws hollow outline shapes (lid/body counters, ruled-line counters, a ring) — they read as outline icons, not filled silhouettes, despite the attribute. `close`/`menu`/`plus` are genuinely `stroke`-based outline. **Every icon in this family reads as outline** — none are true filled silhouettes. | `2` (`close`/`menu`/`plus`) | Row actions, buttons, shell chrome |
| **Domain/nav** | `icon-nav-{key}` | `<app-domain-icon domain="...">` | uniform `0 0 24 24` | uniform `fill="none" stroke="currentColor"`, no explicit linecap (sharp/default caps) | uniform `1.8` | Sidebar nav, search-result badges |
| **Mystery-section** | `icon-mystery-{kind}` | `<app-mystery-section-icon kind="...">` | uniform `0 0 24 24` | uniform `fill="none" stroke="currentColor"`, **round** `stroke-linecap`/`stroke-linejoin` | uniform `1.8` | Mystery dossier headings, countdown clock/stage icons |

~~**This row-action button is squarely the first family.** It's consumed via `<app-icon name="...">`, sized by the caller with plain Tailwind classes, and its two existing occupants in this exact row — `icon-trash` and `icon-pencil` — are both **solid filled silhouettes**, not stroke/line art. That's the local visual language to match, even though it differs from the nav/mystery-section stroke convention elsewhere in the app. A thin-stroke line icon dropped into this row would read as a different species of icon next to the two filled ones already there.~~

**Corrected:** this row-action button is consumed via `<app-icon name="...">` (the generic action/chrome family, mechanically), but *visually* it should match the app's real dominant idiom — explicit `fill="none" stroke="currentColor"` outline, the same register `icon-trash`/`icon-pencil` themselves are drawn in once you look at their geometry rather than their `fill` attribute. `icon-logo` (the favicon/brand mark) is the one genuine exception — hardcoded hex, deliberately filled, and explicitly not a pattern to extend to ordinary UI icons. See the Correction section above.

**Row-action mechanics, from `mysteries-list.html` (and identically in `hunters-list.html`, `monsters-list.html`, `minions-list.html`, `locations-list.html`, `bystanders-list.html`, `monster-detail.html`, `minion-detail.html`):**

```html
<a [routerLink]="[...]" class="action-btn action-btn--edit flex items-center bg-transparent border-0 rounded-md text-muted cursor-pointer justify-center p-[0.375rem] no-underline transition-colors" title="Edit mystery">
  <app-icon name="pencil" class="h-5 w-5" />
</a>
```

- **Size:** `h-5 w-5` (20×20px) on the icon; `p-[0.375rem]` (6px) button padding around it.
- **Color:** default `text-muted`, swaps to a token pair on `:hover:not(:disabled)` via a `.action-btn--{variant}` modifier (global rules in `styles.css:266-280`). Only two modifiers exist app-wide today: `--edit` (`bg-accent-subtle text-accent`) and `--delete` (`bg-danger-subtle text-danger`). **A third row action is a first** in this codebase — no existing three-action row to copy verbatim.
- **Labelling:** native `title="..."` attribute on the button/link; the inner `<svg>` is `aria-hidden="true"` (baked into `IconComponent`'s own template). This is the established convention here — not proposing `aria-label` instead, just noting `title` alone is a weaker screen-reader affordance than `aria-label` if this is ever revisited app-wide.
- **Ordering:** every list row puts destructive last. Delete is always the right-most action; any new action should slot to the left of it, not after.
- **Theme behavior:** every icon in both existing families renders via `currentColor`/token-driven `fill`/`stroke` — nothing is a hardcoded hex except the one-off brand logo mark (`icon-logo`, deliberately fixed). Whatever gets added here inherits light/dark automatically for free as long as it stays `fill="currentColor"` and doesn't hardcode a color, exactly like `icon-trash`/`icon-pencil` do today.

---

## 2. Constraints for the new icon

- Lives in the **generic action/chrome family**: new entry in `IconName` (`icon.component.ts`) and a new `<symbol id="icon-{name}">` in `icon-sprite.component.ts`.
- ~~**`fill="currentColor"`, solid silhouette** — match `icon-trash`/`icon-pencil`'s local convention, not the nav/mystery-section stroke convention.~~ **Superseded — this was the misreading.** Correct constraint: `viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"`, matching the nav/mystery-section outline system (see Correction section above and Section 5). Use the mystery-section flavor specifically — **round** `stroke-linecap`/`stroke-linejoin` — since Skyler's own target register ("a little cartoony/low-fidelity") reads closer to that softer variant than the nav rail's sharper default-cap corners.
- `viewBox="0 0 24 24"` — no longer just "the simplest choice," it's now the actual constraint: match the nav/mystery-section grid exactly rather than treating `icon-trash`/`icon-pencil`'s odd non-standard viewBoxes (`0 40 32 32`, `0 0 100 100`) as precedent.
- Rendered at `h-5 w-5` (20×20px) inside `p-[0.375rem]` button padding — same as its two neighbors. Anything with fine detail (thin strokes, small gaps) will degrade at this size; the concepts below are sized accordingly.
- ~~Needs its own `.action-btn--wizard` (or similarly named) modifier in `styles.css`, since reusing `--edit`'s indigo hover would make it visually indistinguishable from the pencil on hover — the one place these two actions most need to read as different. **Recommend a new hover pairing built from tokens that already exist**, not an invented hue: `--color-badge-archetype`/`--color-on-badge-archetype` (purple-100/purple-700 light, purple-950/purple-300 dark) is already shipping in this app (monster archetype badge, and the favicon's grin per `luigi-favicon-logo-mark.md`) and reads as this codebase's "arcane/magic" accent — reusing it here gives the wizard action a color identity distinct from both Edit (indigo) and Delete (red) without inventing anything new.~~ **Superseded — this was written when the wizard icon was assumed to be a second, coexisting button next to the pencil.** Now that it's a straight glyph swap on the pencil's own link, there's no "distinct from Edit" problem to solve: it *is* Edit, same identity, same destination. Keeps `action-btn--edit`'s existing indigo hover (`bg-accent-subtle text-accent`) unchanged — no new modifier class needed.
- `title="..."` on the button/link, `aria-hidden="true"` on the icon (comes free from `<app-icon>`), matching the row's existing two actions exactly. **The `title` text needs to change alongside the glyph** — see "Accessible label" below.
- Same row position as today (between the mystery's text block and the trash icon, left of Delete) — this was always a swap of the pencil in place, not a new slot to argue over.

**Accessible label (`title` attribute):** the current text, `title="Edit mystery"`, describes the *action* (edit) but not what opens — exactly the gap the glyph swap itself is meant to close. Recommend changing it alongside the icon to **`title="Edit mystery in the wizard"`**. This keeps the existing "`{Verb} {noun}`" pattern shared with the row's other action (`title="Delete mystery"`) rather than inventing new phrasing, while adding the one clause that tells a screen-reader user (who never sees the hat glyph at all) what kind of edit surface they're about to land on. If that reads too long in practice, `title="Continue in wizard"` is a reasonable fallback, but it breaks parity with the sibling `"Delete mystery"` title and drops the word "Edit," which is still accurate — prefer the longer form unless Luigi finds a concrete reason (e.g. tooltip clipping) to shorten it.

---

## 3. Concepts

**These six concepts (below) were all sketched in the wrong idiom — solid `fill="currentColor"` silhouettes — per the mistaken Section 1 read.** Kept verbatim, not redrawn, for an honest record of the original round. Do not use any of these six paths as-shipped; **Section 5 has the corrected, current outline version.**

**Concept A (Wizard Hat) is still the chosen *shape/concept* — Skyler picked the hat over the wand and the other four.** What changed is the *rendering*: the filled version below is superseded by the outline redraw in Section 5. Concepts B–F remain "considered, not chosen" at the concept level, independent of the fill/outline mistake.

### A. Wizard Hat (Skyler-named) — concept CHOSEN, this filled rendering superseded (see Section 5)

Cone + brim + a tiny star at the point. The most literal, most silhouette-legible "wizard" glyph — a triangle-on-an-ellipse reads clearly even fully compressed to 20px, and it shares no shape family with the pencil (rectangle-ish diagonal) or trash (can). Picked over the pure diagonal-bar concepts (B, F) specifically because it carries zero risk of visually rhyming with the pencil glyph it's replacing.

```html
<!-- SUPERSEDED — filled, wrong idiom. Kept for the record only. See Section 5 for the outline redraw to actually implement. -->
<symbol id="icon-wizard-hat" viewBox="0 0 24 24" fill="currentColor">
  <path d="M12 3 17 17H7Z" />
  <rect x="6" y="15.3" width="12" height="2" rx="1" />
  <ellipse cx="12" cy="18.6" rx="8" ry="2" />
  <path d="m12 0.8 0.5 1.3 1.3 0.5-1.3 0.5-0.5 1.3-0.5-1.3-1.3-0.5 1.3-0.5z" />
</symbol>
```

### B. Sparkling Wand (Skyler-named) — considered, not chosen

Diagonal rod with a four-point star burst at the tip and a small trailing sparkle. Reads as "magic" immediately, matching the exact phrase Skyler used.

```html
<symbol id="icon-wizard-wand" viewBox="0 0 24 24" fill="currentColor">
  <rect x="3" y="16" width="15" height="2.2" rx="1.1" transform="rotate(-45 10.5 17.1)" />
  <path d="m17.5 3 1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z" />
  <path d="m7 14.5 0.5 1.3 1.3 0.5-1.3 0.5-0.5 1.3-0.5-1.3-1.3-0.5 1.3-0.5z" />
</symbol>
```

**Watch-out:** worth rendering this one side-by-side with `icon-pencil` before committing — pencils in every common icon set (and quite possibly this app's own, `viewBox 0 0 100 100`, unverified without rendering) are conventionally drawn as a diagonal bar too. Two diagonal-bar icons sitting next to each other in the same 20px row risks reading as near-duplicates from a glance/peripheral-vision distance, exactly the failure mode the "must read as different from the pencil" constraint above is guarding against.

### C. Open Spellbook — considered, not chosen

An open book (two symmetric curved pages) with a small sparkle rising off the top-right page. Ties the icon's *meaning* to what the button actually does — open a multi-step, page-by-page flow — rather than to "magic" generically. Non-diagonal, so it doesn't fight with the pencil.

```html
<symbol id="icon-wizard-book" viewBox="0 0 24 24" fill="currentColor">
  <path d="M3 6.5c2.7-1.3 5.4-1.3 8 0v12c-2.6-1.3-5.3-1.3-8 0z" />
  <path d="M21 6.5c-2.7-1.3-5.4-1.3-8 0v12c2.6-1.3 5.3-1.3 8 0z" />
  <path d="m17.5 3 0.5 1.3 1.3 0.5-1.3 0.5-0.5 1.3-0.5-1.3-1.3-0.5 1.3-0.5z" />
</symbol>
```

### D. Crystal Ball — considered, not chosen

An orb on a small pedestal. Thematically ties to "Mystery" (divination) rather than to wizards specifically, and is non-diagonal.

```html
<symbol id="icon-wizard-crystal-ball" viewBox="0 0 24 24" fill="currentColor">
  <circle cx="12" cy="10" r="6.3" />
  <path d="M5.5 18.5h13l-1.4-2h-10.2z" />
</symbol>
```

### E. Sparkle Cluster (no wand/hat at all) — considered, not chosen

A single bold four-point star with a smaller secondary sparkle — the "magic/assist" glyph shorthand that's become common across modern software UI. The most robust of the six at very small render sizes (fewest, boldest shapes) but the weakest specific tie to "wizard" — elsewhere this glyph usually signals "AI/smart suggestion," which could set the wrong expectation here.

```html
<symbol id="icon-wizard-sparkle" viewBox="0 0 24 24" fill="currentColor">
  <path d="M12 2.5 13.8 8.7 20 10.5 13.8 12.3 12 18.5 10.2 12.3 4 10.5 10.2 8.7Z" />
  <path d="m19 15.5 0.7 2 2 0.7-2 0.7-0.7 2-0.7-2-2-0.7 2-0.7z" />
</symbol>
```

### F. Wand + Steps (hybrid) — considered, not chosen

A shorter wand with a star tip and three diminishing dots trailing off the handle — a wink at "wizard" meaning both the sorcerer *and* the multi-step form, echoing progress-dot conventions. Conceptually the cleverest of the six, but the most crowded (five sub-shapes) and shares Concept B's diagonal-vs-pencil risk — the one most likely to blur into a smudge at 20px.

```html
<symbol id="icon-wizard-wand-steps" viewBox="0 0 24 24" fill="currentColor">
  <rect x="3" y="15" width="10" height="2" rx="1" transform="rotate(-40 8 16)" />
  <path d="m16.5 4 0.9 2.2 2.2 0.9-2.2 0.9-0.9 2.2-0.9-2.2-2.2-0.9 2.2-0.9z" />
  <circle cx="9" cy="19.5" r="1.1" />
  <circle cx="13" cy="20.3" r="0.9" />
  <circle cx="16.5" cy="20.6" r="0.7" />
</symbol>
```

---

## 4. Ranking and trade-offs (as recorded pre-decision — kept for reference)

This was my original ranking, produced before Skyler's decision, written when this was still framed as picking among live options. Recorded as-is rather than rewritten after the fact, since **it's also the reasoning that led to the decision** — Wizard Hat ranked #1 here, and that's what got picked.

1. **Wizard Hat (A) — chosen.** Best combination of the three criteria: bold, simple two-shape silhouette holds up at 20px better than any concept with fine star points or thin diagonals; unambiguous "wizard" meaning; and — critically — it's the only concept with zero risk of visually rhyming with the pencil, since it has no diagonal bar. Only real weakness: a hat, on its own, says "wizard the character," not "wizard the multi-step flow" — a purely thematic gap, not a legibility one.
2. **Open Spellbook (C)** — closest fit to what the button *does* (opens a page-by-page flow), not just what a wizard *is*. Symmetric, non-diagonal, holds up reasonably at small size. Slightly less immediately "wizard"-coded than a hat or wand at a first glance, since a book alone could also read as "docs" or "notes" in some UI vocabularies.
3. **Sparkling Wand (B)** — Skyler's other named option, and probably the most stereotypically "wizard" glyph of all six. Held back from #1 by the diagonal-vs-pencil rhyming risk flagged above and by having the most fragile detail (the four-point star tip) of any concept besides F.
4. **Crystal Ball (D)** — solid, legible, non-diagonal, and thematically apt for a *Mystery* row specifically. Ranked below the top three only because "orb on a stand" reads more generically as "mystery/insight" than specifically as "wizard" — someone unfamiliar with the feature is less likely to guess "click here to enter the wizard" from this shape alone.
5. **Wand + Steps hybrid (F)** — the most conceptually interesting (literally encodes both meanings of "wizard"), but the least likely to survive being shrunk to 20px cleanly — five separate sub-shapes competing for a 20×20px box is a lot, and it inherits Concept B's diagonal risk on top of that.
6. **Sparkle Cluster (E)** — best raw legibility of all six (two bold shapes, nothing fine or diagonal) but weakest semantic fit: this exact glyph shape is widely used elsewhere in software to mean "AI/smart suggestion," which risks miscommunicating what clicking it actually does.

**Decision: Wizard Hat (A).** Skyler confirmed the corrected premise (icon swap on the existing edit link, not a new button) and picked Concept A on that basis. Luigi is fashioning the icon and making the swap in parallel with this doc update — see "Accessible label" above for the paired `title` text change, and the struck-through note above for why no new hover-color modifier is being added.

**Implemented (Luigi, 2026-09-18):** `IconName` landed as `'wizard'` (symbol `icon-wizard`), not `'wizard-hat'` — single-word, matching the rest of the generic action/chrome set (`trash`, `pencil`, `close`, `menu`, `plus`, `spinner`, `search`, `logo`), none of which are compound names. `mysteries-list.html`'s edit link now reads `<app-icon name="wizard">` with `title="Edit mystery in the wizard"`, exactly per the "Accessible label" recommendation above. `icon-pencil`/`'pencil'` were left in place — `mystery-create-monster-phase.html`'s minion-composer edit pencil still uses it. The `/dev/wizard-icons` showcase, its five losing `icon-wizard-*` symbols/`IconName` entries, and the never-shipped `.action-btn--wizard` CSS were all torn down.

**Rejected on sight (Skyler, 2026-09-18):** the filled `icon-wizard` shipped above doesn't match the app's real idiom — see the Correction section near the top of this doc and Section 5 below for the outline redraw Luigi is implementing in its place. The `IconName`/symbol-ID naming precedent above (`'wizard'` / `icon-wizard`, single-word) still stands; only the path data inside that same symbol needs to change from the filled version to the Section 5 outline version — no new `IconName` entry needed.

---

## 5. Revised recommendation (current — outline, corrected idiom)

**Primary: outline Wizard Hat**, redrawn in the app's real system: `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `stroke-width="1.8"`, round `stroke-linecap`/`stroke-linejoin` (the mystery-section flavor of the outline convention, chosen over the nav rail's sharp-cornered flavor specifically because it reads softer/friendlier, closer to Skyler's "cartoony/low-fidelity" target). Two strokes only: a closed triangle for the cone, and one open curve for the brim underneath it — deliberately less detailed than the original filled version (no separate star, no separate band), since Skyler's brief was "simpler," and a two-shape glyph is the most likely of any option here to stay crisp at 20px next to the trash can's more complex outline.

```html
<symbol id="icon-wizard" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8">
  <path d="M12 3 17.5 15.5 6.5 15.5Z" />
  <path d="M4.5 15.5Q12 18 19.5 15.5" />
</symbol>
```

Reused the `icon-wizard` symbol ID Luigi already wired up (see "Implemented" above) — only the markup inside the `<symbol>` changes, not the ID, the `IconName` entry, or the call site in `mysteries-list.html`.

**Why this still reads as a hat, not a mountain/pyramid, at 20px:** the triangle alone (apex + two straight base sides) risks that ambiguity, which is exactly why the brim curve is load-bearing here, not decorative — it's what breaks the silhouette out of "generic triangle" territory into "hat," the same way `icon-nav-locations`' pin shape needs its circle to read as a map pin rather than a balloon. Round `stroke-linejoin` softens the triangle's corners enough to keep it in the "cartoony/low-fidelity" register Skyler asked for, rather than a crisp geometric mountain glyph.

**Distinctiveness vs. the trash can sitting next to it:** strong. `icon-trash` is a tall, narrow, vertical rectangle-with-lid silhouette with internal rib lines; this hat is a wide, short, horizontal triangle-on-a-curve with no internal detail. Different aspect ratio, different stroke count, no shape-family overlap — safer on this axis than any of the original six filled concepts were against the *pencil* (Concept B/F's diagonal-rhyming risk doesn't apply here at all, since the pencil is gone from this row now).

**Brief alternate — curled-tip hat:** if the plain triangle reads too generically geometric once rendered (a real risk worth checking live before locking this in), a version with the apex bent into a small curl reads more specifically "wizard/witch hat" and less "party hat/mountain," at the cost of one more curve to keep crisp at 20px:

```html
<symbol id="icon-wizard" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8">
  <path d="M12.5 3.2c1.8-.6 3 .9 1.8 2-1 .9-.2 1.6.9 1.3L17.5 15.5 6.5 15.5Z" />
  <path d="M4.5 15.5Q12 18 19.5 15.5" />
</symbol>
```

This alternate's curl segment is a rougher sketch than the primary's straight lines — straight lines are trivial to get pixel-right by hand, a small bezier curl is not, so expect this one specifically to need more live tuning in the browser if Luigi/Skyler end up preferring it over the plain-triangle primary.

**Recommendation: ship the primary (plain triangle + brim).** It's the simpler of the two, matches "simpler... low-fidelity" most literally, and the mountain/pyramid ambiguity concern is a "check it live" risk rather than a known problem — the brim curve is doing real disambiguating work. Reach for the curled-tip alternate only if the plain triangle actually reads wrong once Luigi renders it in the row.

---

## 6. Implementation note (Luigi, 2026-09-18): the literal primary path needed a geometry fix

Rendered the primary exactly as specified above via a standalone Playwright screenshot at 20px, 48px, and 96px (same verification method as the original six-concept pass). Two problems, both confirmed visually rather than assumed:

1. **The plain triangle read as a mountain, not a hat**, at both 20px and 48px — the brim curve's sag (its control point is only 2.5 units below its endpoints, which sit at the same y as the closed cone's base) was too shallow to register as a separate shape next to the cone at this size.
2. **At 96px the problem was visible directly:** the cone's `Z`-closed base edge sits almost exactly on top of the brim curve's endpoints (both at `y="15.5"`), so the two strokes partly overlapped into one thickened blob across the middle of the glyph instead of reading as two distinct shapes — the exact collision risk flagged before implementation.

Fix shipped in `icon-sprite.component.ts` (markup only, same `id="icon-wizard"`, same `IconName`, same call site):

```html
<symbol id="icon-wizard" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8">
  <path d="M6.5 14.6 12 3 17.5 14.6" />
  <path d="M4.3 16.2Q12 19.6 19.7 16.2" />
</symbol>
```

- The cone is now **open** (apex to each base corner, no closing base edge) — the brim supplies the visual "base" instead of competing with one.
- The brim curve's endpoints moved to `y="16.2"`, about 1.5 units below the cone's base corners (`y="14.6"`), so the two strokes stay visibly separated rather than colliding.
- Re-rendered at all three sizes after the fix: reads clearly as a hat (open cone + separate curved brim) even at 20px, no doubled/thickened line at any size. Did not need the curled-tip alternate — the plain triangle reads fine once the brim is actually visible as its own shape.

---

## 7. Superseded (Luigi, 2026-09-18): Skyler supplied his own artwork

Skyler supplied his own wizard-hat SVG directly, superseding Section 6's hand-drawn outline (which was never actually shown to him before this — the outline redraw in Section 5/6 was Rosalina's and Luigi's own correction of the rejected filled version, not something Skyler had seen and rejected in turn). His artwork is what's live now:

```html
<symbol id="icon-wizard" viewBox="0 0 24 24" fill="currentColor">
  <path d="m22.717,21.016l-4.925-11.976c-.406-.948-.375-2.021.087-2.943l1.963-3.926c.253-.507.199-1.113-.14-1.568-.338-.453-.904-.679-1.463-.58l-4.14.73c-3.242.572-5.916,2.735-7.16,5.802L1.274,21.017c-.721.109-1.274.731-1.274,1.483,0,.829.671,1.5,1.5,1.5h21c.829,0,1.5-.671,1.5-1.5,0-.755-.557-1.379-1.283-1.484ZM9.727,7.667c.846-2.087,2.676-3.567,4.895-3.959l1.204-.212-.63,1.26c-.857,1.714-.916,3.707-.169,5.447l4.441,10.798H4.503l5.224-13.333Zm4.273,6.334c.307,0,.583.187.697.472l.523,1.308,1.308.523c.285.114.472.39.472.697s-.187.583-.472.697l-1.308.523-.523,1.308c-.114.285-.39.472-.697.472s-.583-.187-.697-.472l-.526-1.316-1.318-.555c-.283-.119-.464-.398-.459-.705.006-.307.198-.579.484-.687l1.299-.492.52-1.301c.114-.285.39-.472.697-.472Zm-5-2.54c.005-.255.165-.482.404-.573l1.082-.41.433-1.084c.095-.237.325-.393.58-.393s.486.156.58.393l.436,1.09,1.09.436c.237.095.393.325.393.58s-.156.486-.393.58l-1.09.436-.436,1.09c-.095.237-.325.393-.58.393s-.486-.156-.58-.393l-.439-1.097-1.099-.463c-.236-.099-.387-.332-.382-.587Z" />
</symbol>
```

A **filled** path with hollow counters (a curled hat body plus two sparkle cutouts) — the `icon-trash`/`icon-pencil` idiom after all, not the outline idiom Section 5 moved to. That's not a contradiction of the "match the app's real system" finding: `viewBox="0 0 24 24"` was kept exactly as he authored it (matches this row's convenience choice already), and `fill="currentColor"` (added — his source had none) is what makes it inherit the theme the same way `icon-trash`/`icon-pencil` do. Only the fill/stroke *style* differs from Section 5/6's outline attempt; the *mechanism* (currentColor-driven, no hardcoded color) is identical to every other icon in this sprite except `icon-logo`.

Path `d` data is byte-for-byte what Skyler supplied — not redrawn, rescaled, or otherwise touched. The wrapper attributes his source file needed as a standalone SVG (`xmlns`, `id="Layer_1"`, `data-name="Layer 1"`, `width="512"`, `height="512"`) were stripped; none belong on a sprite `<symbol>`, and none affect rendering once it's a `<use>` target sized by the caller's Tailwind classes.

**Verified (Luigi):** rendered via the real compiled `styles.css` (from the last production build) loaded into a standalone Playwright page, using the actual `action-btn action-btn--edit` classes and a real `:hover` (not a faked style) — confirmed at 20px it reads clearly as a hat with sparkle detail, confirmed `fill="currentColor"` correctly tracks `text-muted` at rest and `action-btn--edit`'s indigo hover in both light and dark themes (light: slate-500 rest → indigo-600 hover; dark: slate-400 rest → indigo-400 hover), and confirmed it's legible blown up to 96px with no artifacts.

**Addendum — Section 7's path is itself now stale.** Skyler replaced his own artwork again with a thinner-stroke version; the symbol actually live in `icon-sprite.component.ts` today (confirmed directly, not re-described here from memory) wraps a different `d` in a `<g transform="translate(1.2 1.2) scale(0.9)">` (Luigi's 90% scale-down, added when the thinner strokes read slightly large against `icon-trash`/`icon-pencil` at 20px). Not reproducing the byte-for-byte path here — read `icon-sprite.component.ts`'s `#icon-wizard` symbol directly for the current source of truth rather than trusting either Section 7's path or this note going forward; this doc has now been wrong about the exact shipped geometry twice (Sections 5→6 outline, then 7 itself superseded), which is reason enough to stop copying the path into the doc and just point at the file.

---

## 8. Mystery Detail page — second placement of `icon-wizard` (Skyler, 2026-09-18)

New ask: a link back into the wizard from `mystery-detail.html`, so Skyler can jump from reviewing a mystery straight into continuing an incomplete build. **Additive, on a different page — does not touch the mysteries-list swap above, which stays as shipped.** Advisory only; no app code changed by this doc.

### 8.1 What's on the page today

Read `mystery-detail.html`/`.ts`/`.scss` directly. Structure: a bare `← Back to mysteries` link, then (once loaded) a title row (`<h2>` + the amber adventure-type badge, both on one plain `flex items-baseline` line with **no action slot** — unlike `monster-detail.html`/`hunter-detail.html`, which put their header content in a `flex ... justify-between` row precisely so something can sit at the right edge), then a stack of read-only `<section>`/`<article>` cards (Concept/Hook/Overview, Countdown, then a 4-up grid of Monsters/Minions/Locations/Bystanders link lists). **There is no interactive edit affordance anywhere on this page today** — no button, no icon, nothing. `mystery-detail.scss` only sets the two `--mystery-section-icon-size` custom properties used by the decorative section-heading icons (`app-mystery-section-icon`); those are non-interactive, sized larger (2rem) for section headings and smaller (1rem) for countdown-stage labels, and aren't a precedent for an action control.

### 8.2 What every other detail page does — and why Mystery is the odd one out

Globbed `features/**/*-detail.html` (5 other detail pages: monster, minion, location, bystander, hunter) rather than assuming the three named in the ask. Finding, stated plainly since it changes the recommendation: **no other detail page has a "link to an edit surface" affordance at all**, because no other domain *has* a separate edit surface — `monster-detail.html`, `minion-detail.html`, `location-detail.html`, and `bystander-detail.html` all embed their own edit form directly inline on the page itself (`<app-monster-form [monster]="monster()" ... (save)="saveMonster($event)">`, and the `-minion-`/`-location-`/`-bystander-form` equivalents) — editing *is* being on the detail page, there's nothing to link to. Mystery is architecturally the outlier here: its "edit surface" is a separate route running a whole different component (`MysteryCreateComponent`, the multi-phase wizard), not an inline form on `MysteryDetailComponent` — which is exactly why the list row needed an explicit edit link in the first place, and why the detail page needs one too, unlike its five siblings.

The one genuine precedent for **a primary action control living in a detail page's header** is `hunter-detail.html`: a labelled text button — `Delete hunter`, plain-language label, no icon — sitting top-right in a `flex flex-wrap items-center justify-between gap-3 mb-4` row alongside the title/badge cluster on the left. That row-shape (title+badges left, one action right) is the pattern to reuse for placement; Mystery's current title row just doesn't have the `justify-between`/right-hand slot yet.

### 8.3 Recommendation: labelled button, not a bare icon — and here's the placement/markup

**Labelled, not bare-icon.** Skyler's parenthetical floated "probably just the same wizard hat icon," but I'd push back on bare-icon-only here, for a reason specific to this page rather than a general aesthetic preference: the list row's bare icon works *because* it sits directly next to a second bare icon (trash) in a dense row, which teaches "icons are the interactive things here" contextually, and screen space is genuinely tight there. Neither is true on the detail page — it's the *only* interactive control that would exist on this page (see 8.1), there's no sibling icon-button to establish the vocabulary, and the page has abundant width in the header row. An unlabelled icon in that position risks reading as decorative (like the section-heading icons already on this exact page, which are non-interactive) rather than clickable. `hunter-detail.html`'s labelled-text-button precedent (8.2) backs this up — it's the one existing example of a detail-page header action, and it's text, not a bare icon.

**Placement:** give the title row the same `justify-between` treatment `hunter-detail.html`/`monster-detail.html`'s header rows already use, and put the new link on the right, mirroring `hunter-detail.html`'s slot exactly. Concretely, replace `mystery-detail.html`'s current title block:

```html
<div class="flex flex-wrap items-baseline gap-3 mb-2">
  <h2 class="m-0">{{ mystery()!.name }}</h2>
  <span class="rounded-full text-[0.72rem] font-semibold tracking-[0.02em] px-[0.55rem] py-[0.15rem] whitespace-nowrap bg-badge-mystery text-on-badge-mystery">{{ mystery()!.adventureType.name }}</span>
</div>
```

with:

```html
<div class="flex flex-wrap items-center justify-between gap-3 mb-2">
  <div class="flex flex-wrap items-baseline gap-3">
    <h2 class="m-0">{{ mystery()!.name }}</h2>
    <span class="rounded-full text-[0.72rem] font-semibold tracking-[0.02em] px-[0.55rem] py-[0.15rem] whitespace-nowrap bg-badge-mystery text-on-badge-mystery">{{ mystery()!.adventureType.name }}</span>
  </div>
  <a
    [routerLink]="['/mysteries', mystery()!.id, 'edit']"
    class="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover rounded-lg text-on-accent text-[0.9rem] font-semibold py-[0.55rem] px-5 no-underline transition-colors whitespace-nowrap"
  >
    <app-icon name="wizard" class="h-5 w-5" />
    <span>Continue in wizard</span>
  </a>
</div>
```

- **Same destination as the list row's link** — `['/mysteries', mystery()!.id, 'edit']`, no new route needed.
- **Styling reused, not invented:** this is the app's existing filled-pill primary-CTA treatment (`bg-accent hover:bg-accent-hover rounded-lg text-on-accent ... py-[0.55rem] px-5`), the same classes `mysteries-list.html`'s "Create something new..." and `monster-detail.html`'s "+ Add Minion" already use. I chose this over `hunter-detail.html`'s outline/`text-danger` treatment because that one is specifically the *destructive*-action style (bordered, danger-colored) — wrong register for an affirmative "go keep building" action. The filled-accent pill is this app's actual "go do the primary constructive thing here" convention, and reusing it means this link doesn't have to invent its own visual weight.
- **No `title` attribute.** Unlike the list row's bare icon (which needs `title` because it has no visible text), this control has a visible label doing the accessible-naming work — matching the two precedents it's copying the pill styling from (`+ Add Minion`, `Create something new...`), neither of which carries a `title`. The `<app-icon>` SVG stays `aria-hidden="true"` automatically (baked into `IconComponent`), so nothing announces the glyph twice.
- **Needs `IconComponent` added to `MysteryDetailComponent`'s `imports` array** (`mystery-detail.ts` currently imports only `RouterLink`/`MysterySectionIconComponent` — `<app-icon>` isn't available on this page yet).

### 8.4 Accessible label / visible text wording

**Recommend `Continue in wizard`** as the button's visible text (doubling as its accessible name — no separate `aria-label` needed). This is a deliberate departure from the list row's `title="Edit mystery in the wizard"` phrasing, not an inconsistency: Skyler's own stated motivation here is specifically "jump straight back into working on an incomplete mystery" — *continuing* unfinished work, not *editing* a finished one — and "Continue" matches that framing directly, the same way `hunter-create`'s own in-progress-resumption language already leans on "continue"/"still to finish" elsewhere in this app rather than "edit." **Alternate: `Edit in wizard`**, if Skyler/Luigi would rather keep exact wording parity with the list row's `"{Verb} {noun}"` title pattern — reasonable, just less specific to the actual motivation for this particular link.

### 8.5 Completeness — investigated directly, here's the unhedged answer: **not available on this page, ship the unconditional version**

Checked both places a completeness signal could live:

- **`mystery-create.store.ts`** does have a completeness concept — `phaseComplete: signal<boolean[]>` / `phaseStepComplete: computed<boolean[][]>` — but it's **purely local, in-session UI state**, tracking which of the wizard's 4 phases the *current browser session* has stepped through while actively editing. It's constructed fresh inside `MysteryCreateStore` (provided at the create/edit route component level, per the `.squad/decisions.md` architecture entry) and never persisted anywhere. It does not exist before you open the wizard, and it's gone the moment you navigate away.
- **The API contract** (`core/models.ts`) confirms this isn't a server concept either: `MysteryDetailResponse` — what `mystery-detail.html` actually renders from — has no completeness/outstanding/status field of any kind. Contrast directly with Hunters, which *do* have a real, server-computed completeness signal already wired to a detail page: `HunterDetailResponse.outstanding: string[]`, rendered on `hunter-detail.html` as a "Still to finish" panel plus a "Ready to play" badge when the list is empty. That's the shape a mystery-completeness feature would need to copy — a backend-computed field on `MysteryDetailResponse` — and it plainly doesn't exist today.

**So: no completeness state is available on the mystery-detail view, full stop — not a hedge, a confirmed gap.** Recommend shipping the **unconditional** version in 8.3: the "Continue in wizard" link always present, no emphasis/gating/badge tied to whether the mystery is "done," because there is no data to drive that distinction without new backend plumbing (a `MysteryDetailResponse.outstanding`-equivalent field, mirroring the Hunter pattern). That backend work is a legitimate feature idea to raise with Peach/Skyler separately if mystery-completeness tracking is wanted later — precedent already exists to copy (Hunters) — but it is out of scope for this design task and I'm not going to fold a plumbing dependency into "add a link" by implication.

### 8.6 Implemented (Luigi, 2026-09-18)

Shipped 8.3's markup and 8.4's "Continue in wizard" wording verbatim, unconditional per 8.5 — no backend plumbing touched. Verified before shipping:

- **`IconComponent` was indeed missing** from `MysteryDetailComponent`'s `imports` (`RouterLink`, `MysterySectionIconComponent` only) — added it, confirmed by reading the file rather than trusting the claim.
- **The CTA classes hadn't drifted:** `mysteries-list.html`'s "Create something new..." link carries exactly `bg-accent hover:bg-accent-hover rounded-lg text-on-accent text-[0.9rem] font-semibold py-[0.55rem] px-5 no-underline transition-colors whitespace-nowrap`, byte-for-byte what section 8.3's markup reuses (plus `inline-flex items-center gap-2` for the icon+label layout, which "Create something new..." doesn't need since it has no icon).
- **Rendered it** (compiled `styles.css` from a production build, loaded into a standalone Playwright page, real classes/markup) in both themes: `fill="currentColor"` correctly tracks `text-on-accent` — white icon on the indigo-600 pill in light, slate-900 icon on the indigo-400 pill in dark. Confirms the pill needs no separate icon-color handling beyond what `text-on-accent` already provides.
- **`mystery-detail.spec.ts`** had no existing pattern for asserting on a header link (no other detail-page spec in this codebase tests one either — `hunter-detail.html`'s precedent action doesn't have a spec file at all). Added one test in the existing spec's own `querySelectorAll`/`textContent` style, asserting the link's `href`, visible label, and the icon's presence.
- Build (`ng build --configuration development`) and full suite (`ng test`) both clean: 736/736 tests across 73 files (735 before this change, +1 new test).
