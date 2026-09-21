# Hunter Playbooks — The Forged Corrected (Bonds/Burdens Out of Scope), Relayed-Quote Verification Standard, PDF Column-Swap Hazard Documented

**By:** Yoshi (Architect)
**Date:** 2026-08-27

## What

Three corrections/additions to the walkthrough, all same round:

1. **Bonds/Burdens removed from `bespoke-ruleset-catalogue.md`'s `## The Forged` entry.** They're not a bespoke ruleset — they're pick-based content belonging to Partner, a `Required` Move exclusive to this playbook. Moves are out of scope for this catalogue (Phase 4's job). Removed the `### Bonds`/`### Burdens` entries entirely; added a one-line flag on Partner's own Moves paragraph instead, noting it needs special handling beyond a plain description when Moves are modeled.
2. **A fabricated quote corrected.** A prior round of this entry stated "Skyler's relayed description of the Moves layout was '2 required + pick-two pool, like Curse-Eater'" as if Skyler said it. Skyler didn't — the coordinator invented those specifics while paraphrasing Skyler's real (correct, vaguer) statement that Forged and Curse-Eater share a dual-column Moves layout trait. Corrected in the catalogue; the actual counts (1 required + pick 1 of 6) stand as this entry's own independent finding, not a confirmation of anything Skyler said.
3. **New standing practice: treat "Skyler said X" with the same verification discipline as a PDF page read.** I have no independent channel to verify what Skyler actually said (unlike PDF content, which I can always re-check directly against the source) — so a relayed quote, especially a specific/quotable one, gets flagged as worth double-checking rather than repeated as fact. Going forward: when writing up a stakeholder's stated expectation, prefer summarizing the gist rather than reproducing a "quote" I can't independently verify, unless it's clearly marked as the coordinator's own paraphrase.

Separately, investigated and documented a real PDF-generation defect (`pdf-extraction-pipeline.md`, new "Addendum" section): The Forged's page 23 has columns 2 and 3 swapped in the underlying text-stream order (confirmed independently via `pdftotext -raw`). Confirmed the tool actually used for all page-level structural reads in this walkthrough (bare `pdftotext -f N -l N`, never `-raw`) already reconstructs correct order on the affected page regardless. Spot-checked `pdftotext -raw` against all 12 pages used across the 11 previously-processed playbooks — zero further instances of the swap found, including Curse-Eater (the closest structural analog). No re-verification of prior playbooks warranted on this specific basis.

## Why

Full reasoning and evidence: `docs/hunter-playbooks/bespoke-ruleset-catalogue.md` (`## The Forged`), `docs/hunter-playbooks/pdf-extraction-pipeline.md` ("Pipeline-integrity check" — Bowser's pdf.js-based immunity finding — and "Addendum: Yoshi's structural-read risk assessment" — this round's independent `-raw`-based re-confirmation and 11-playbook spot-check). `.squad/agents/Yoshi/history.md` (2026-08-27, "Round Two" entry) has the full narrative.
