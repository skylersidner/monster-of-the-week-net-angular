### 2026-10-07: An `<li>` in a `grid` list needs `min-w-0` once its content is a flex row — 5-for-5, so it's a rule

**By:** Rosalina (Designer)

**What:** Treat this as a standing frontend layout rule rather than a bug rediscovered per page:

> **When a list `<ul>` is a `grid` and its `<li>` content becomes a horizontal flex row, the `<li>` needs `min-w-0`.**

**Why it isn't a one-off.** Grid items default to `min-width: auto`, so an `<li>` claims its *min-content* width. As long as the row's content is plain text that wraps, nothing shows. The moment the row holds a flex pair that can't shrink below its contents — a fixed-size thumbnail beside a text block, a name beside an action cluster — min-content exceeds the track and the row overflows it. The failure is lateral and silent: no error, no console warning, just a row wider than its container, a horizontally scrolling page, and whatever sits at the trailing edge (typically the delete button) pushed off-screen. Measured instance from the resource-images work: a 488px row in a 358px track on a 390px viewport.

**The count is the argument.** Verified by grep rather than taken on report — **five of five** `<li>`-in-grid list surfaces in this app now carry `min-w-0`, and every one of them got it as a *fix* after the overflow was observed, not as part of writing the row:

- `monsters-list.html`
- `minions-list.html`
- `locations-list.html`
- `bystanders-list.html`
- `monster-detail.html` (the nested Minions block)

A pattern that has been rediscovered five times out of five opportunities is not a special case; the next person writing a sixth list row will hit it too, and will hit it in the one condition where it's least likely to be caught — a narrow viewport, after the layout already looked correct on a desktop monitor.

**Also worth knowing: at least one instance predated the feature that found it.** The list-page occurrences were verified by stash to be pre-existing, i.e. the thumbnail work *exposed* the bug rather than introducing it. So this rule is retroactive as well as forward-looking — any existing grid list that later grows a flex row inherits the problem without anything in that change looking risky.

**Scope, stated so it isn't over-applied:** this is about `<li>` elements that are *grid items*. A `<li>` in a plain block or flex-column list has no `min-width: auto` behaviour to override and doesn't need it. The trigger is the combination — grid parent, flex-row child.

**Not promoted to `.squad/decisions/README.md` by me.** That index is explicitly "what still binds," and promotion into it is a deliberate, separate act per its own rules; §5 (Design system) is where this would go if someone decides it belongs there. Filing the record is the part that's mine.

**A durable follow-up that is not mine to make, because it's app code:** this project documents its CSS conventions *in place*, as comment blocks in `src/styles.css` (see the `.action-btn` and `.entity-link` blocks, both of which explain a non-obvious mechanism at the point of definition). A short comment there — or on a shared list-row class if one is ever extracted — would catch this at authoring time in a way a decision record cannot, since nobody greps `.squad/` while writing a template. Worth Luigi's judgment on whether it goes in `styles.css` or stays documentation-only.

**Credit:** the pattern and the 5-for-5 count are Luigi's observation, from the resource-images Phase 6 work; this record exists because the rule is not resource-images-specific and `docs/resource-images/design.md` is the wrong venue for it.
