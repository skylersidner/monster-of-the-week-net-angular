# Mystery List — Edit-Link Icon (Wizard Hat)

**Prepared by:** Rosalina (Designer)
**Requested by:** Skyler Sidner
**Date:** 2026-09-18 (revised twice same day — see Correction section below for the second revision)
**Status:** Concept A (filled Wizard Hat) shipped, then **rejected by Skyler on sight** — it doesn't match the app's actual dominant idiom. Root cause: my read of the icon system in Section 1 was wrong (see Correction, directly below). Sections 5/6 (outline redraw) were Luigi's/my own correction, superseded before Skyler ever saw them: **Section 7 is what's actually live** — Skyler supplied his own SVG artwork directly. Sections 1–6 are kept for the record but contain a corrected error and a since-superseded recommendation; read the strikethroughs/callouts, don't take the original prose at face value.

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
