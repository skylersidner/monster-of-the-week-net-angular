### 2026-09-21: R3 — the default review surfaces live in a skill, because the brief template this repo is assumed to have does not exist

**By:** Peach (Product Owner / Business Analyst)

**What:** R3's default surface list and its one-line instruction are at **`.squad/skills/review-brief-surfaces/SKILL.md`**. Three corrections to the draft list, and one qualification on how strongly R3 should be relied on.

---

**Where review briefs are templated: there is no template file in this repo.**

Verified rather than inherited, because the plan's R4 scoping was wrong about where things lived and the same risk applies here.

- **`.squad/templates/` does not exist.** `squad.agent.md` references it six times — `ceremony-reference.md`, `orchestration-log.md`, `skill.md`, `mcp-config.md`, `plugin-marketplace.md`, `casting-policy.json` — and lists it in the Source of Truth Hierarchy. None of those files is present. Every one of those pointers is dead. *(Flagged, not fixed: not R3's scope, but it is the same broken-pointer class R4 was raised for, and R4's owner is still in `.squad/`.)*
- **The nearest thing to a brief template is real, and it is the agent spawn prompt** in `.github/agents/squad.agent.md` (the "Template for any agent" block). It already carries the exact hook R3 needs: `INPUT ARTIFACTS: {list exact file paths to review/modify}`. R3 is, in effect, a request to start populating a field that already exists.
- **But that file cannot be the home.** It is stamped `<!-- version: 0.9.1 -->` and the stamp is rewritten on install/upgrade, so anything added there is lost at the next upgrade. Its own Source of Truth table also lists its only writer as the human repo maintainer. **A line added there would be both out of bounds and temporary.**

**So the home is a skill, and that is a better home than the template would have been.** Skills are the one mechanism in this system that agents are permitted to write; the coordinator injects a matching skill into the spawn prompt automatically (*"Relevant skill: … — read before starting"*), and the standard spawn prompt separately tells every agent to read relevant skills before working. A skill therefore reaches the reviewer **without depending on the brief author remembering** — which is a strictly stronger guarantee than a template line, whose failure mode is silent omission.

One precedent already exists (`.squad/skills/angular-wizard-decomposition/`), so this is the second instance of a shipped pattern rather than a new one.

**Not duplicated into the index.** `.squad/decisions/README.md` §1 already carries Koopa's R3 decision, and the index rule is that agents write records and never the index. **Proposed, for whoever maintains it:** append a pointer to the existing §1 row — *"Default surfaces: `.squad/skills/review-brief-surfaces/SKILL.md`"* — rather than a second row. One decision, one line.

---

**Three corrections to the draft surface list**, from re-checking my fifteen findings against it rather than from memory.

1. **"The feature's largest store or service file" is not a usable selector.** Size was a coincidence — `mystery-create.store.ts` was both the feature's centre and the frontend's largest file — and "largest" would send the next feature's reviewer back to the same file regardless of what is being built. The selector is **the file the feature writes into**, and it needs no judgement: every architecture document in `docs/updates/` carries a *"Files this touches"* section. Take the surface from there.
2. **Templates are missing and produced two of the fifteen.** A literal `Finish` in `mystery-create.html` contradicting a design document's "continue to the next step"; and four consumers of `monsterPreview()` in `mystery-create-dossier.html` where the design named one. Neither is reachable from the store. Both are the same question — *who else reads this?* — so they widen row 3 rather than adding a row: **a state file and its readers are one surface.**
3. **Row 1 should name the `Upsert*Request` records, not `ApiContracts.cs`.** The file holds both directions and its response half overlaps `core/models.ts`. The half that produced the sharpest finding in the feature is the request records, because that is where *"can the API even express this?"* is answered. "Read `ApiContracts.cs`" is not an instruction at that file's size.

Counts, for the record: **13 of my 15 from the store and its templates, 1 from `core/models.ts`, 0 from `ApiContracts.cs`.** Row 1 stays anyway — the re-parent gap was found there and it is the single best piece of evidence for R3, because two competent authors asserted a capability across three review rounds and the request record was the only thing that disagreed.

---

**The qualification, and it is load-bearing.**

**Naming a file converts a reviewer who would have read documents into one who opens a file. It does not make them ask a question the file answers.**

The 50-to-4 ratio measures where findings were *found*, not what caused anyone to look — and in my three passes the cause was never a brief naming a file. It was always a question the documents could not settle: *when do removals actually apply* (had to read `back()` and `jumpToPhase`); *what does the picker hand you* (had to read the option type); *do these three removal rules compose* (had to read what `idsToRemove` excludes).

**What forced the reading was the deliverable, not the brief.** An acceptance criterion states what will be observably true, and that cannot be written from a document describing intent. Any brief whose output is a *claim about behaviour* gets this effect for free; any brief whose output is an *opinion about a design* will not, however many files it names.

So R3 is real and worth adopting at zero marginal cost, and it is weaker than the ratio implies in a specific way: **the brief's verb matters more than its noun.** `Read core/models.ts` is the form that looks like compliance and yields nothing. `Read core/models.ts and confirm the picker's option type carries what the draft needs` is the form that works. The skill leads with that rather than with the file list.

**Failure signal, made checkable by someone other than me.** Yoshi's signal — *"a review pass that produces only document-internal findings"* — is unverifiable unless the report says where each finding came from. So the skill requires one parenthetical per finding naming its surface. Then the signal reads off any review report in a single pass, by anyone, without knowing the feature; and the surface list becomes self-correcting, since surfaces that never appear should be dropped and surfaces that keep appearing unbidden should be added.
