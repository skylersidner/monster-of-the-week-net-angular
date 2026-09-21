### 2026-09-20: Mystery Entity Linking Phase 3 — `footnote` renders unconditionally, but its default becomes `''`
**By:** Luigi (Frontend Developer)

**What:** `ConfirmDeleteModalComponent.permanenceNote` is renamed `footnote` and rendered unconditionally, per `mystery-entity-linking-ux.md` §7.1. **One correction to that section:** its parenthetical says *"its shipped default `'This cannot be undone.'` still works for every current caller."* It does not, and the default is now `''`.

**Why:** Seven of the fourteen shipped call sites pass that exact sentence as **`message`** with an empty `items` — `hunters-list`, `hunter-detail`, `minions-list`, `playbook-admin`, and the three list pages this phase sweeps. Three more (`mysteries-list`, `monster-detail`, `minion-detail`) pass nothing and fall through to `message`'s own identical default. They were all using `message` as a footnote *because the footnote never rendered when `items` was empty* — which is the very defect §7.1 is fixing. Keeping the old default while making the block unconditional would print "This cannot be undone." twice on all ten.

Three options were on the table:

1. **Keep the default, reword the ten call sites.** Correct end state, but it is a ten-template sweep outside this phase's scope, and the brief is explicit that no existing call site should change behaviour.
2. **Suppress a footnote identical to the message.** Two lines, and magic — a silent string comparison deciding whether a paragraph renders is the kind of rule nobody finds later.
3. **Default to `''` and let callers ask.** Chosen. Every existing call site renders byte-identically, because none of them passes a footnote; the only ones that do (`hunter-create` ×2, the wizard's minion roster) pass it explicitly and now get it rendered even with an empty `items`, which is precisely the fix §7.1 asked for.

**The one deliberate exception**, called out rather than folded in: under the old default, `monsters-list` *with* minions did render "This cannot be undone." (its `items` was non-empty). With an empty default it would have lost that line — so `monsters-list` now passes an explicit footnote, as do `locations-list` and `bystanders-list`. All three are pages this phase rewrites anyway.

**Also decided, same component:** the `usage`/`usageMessage` pair renders *above* `message`/`items` and never merges with it. §7.1's reasoning is that a removal answers two different questions — *where is this used* (Detach vs. Delete) and *what is destroyed with it* (Delete vs. Cancel) — and `items` already means the second one on `monsters-list`. Merging them would displace a shipped disclosure to add a new one.

**Verification:** `npx ng build --configuration production` clean, with the two pre-existing budget warnings. `npm test`: 77 files / 888 tests, from a 74 / 816 baseline. Backend untouched, still 533. 34 negative controls, all caught — including `modal-footnote-default-restored`, which was MISSED until a test was added that renders the modal the way a shipped call site does (message only, no footnote) and counts the sentence.

---

### 2026-09-20 addendum: two corrections absorbed, and the `forkJoin` call

**Corrected, no code change:** the call-site count is **13 elements across 12 templates**, not 14. `hunter-create.html` is the only page with two; the apparent second elements on `monster-detail.html:241` and `minion-detail.html:211` are closing tags of the same elements. And the footnote problem was **ten callers, not seven** — seven pass the permanence sentence explicitly as `message`, and three more (`mysteries-list`, `monster-detail`, `minion-detail`) pass no `message` at all and inherit its default, which is the same sentence. The fix and the choice of `''` were right either way; the numbers in the component comment and the spec comment are what was off, and both are corrected.

**New decision — the three swept pages no longer `forkJoin` their list with `getMysteries()`.** The mystery list is disclosure data for the delete dialog, not page data, so gating `isLoading` on it let a slow `/api/mysteries` delay the list itself. The two loads are now independent and the usage block fills in when it arrives.

**One consequence flagged rather than decided:** decoupling creates a third state Rosalina's §7.7 copy does not name — the lookup is neither failed nor available, it is still in flight. Both states currently render `Couldn't check which mysteries use this {noun}.` The user-facing consequence is identical (no verified usage; cancel and retry), and inventing a second string would be inventing copy that has not been ruled on — so the shared string covers both and the code says so explicitly. If Rosalina wants "Still checking…" as a distinct state, it is one more function in `shared/mystery-usage.ts` and one branch per page.
