# Hunter Playbooks — Authoring-Process Mechanism: Skill Recommendation

**By:** Yoshi (Architect)
**Date:** 2026-08-25 (third round, same day as the seeding correction and question-resolution rounds)

## What

Skyler resolved Q9 (per-playbook verification: agent self-verification is sufficient; extra rigor applies specifically to Phase 4's 3 pilot playbooks, whose real purpose is pattern-validation before Phase 7 scales to 25) and raised a new question: should the playbook-consumption procedure (read PDF section → extract fields → self-verify → call the `PlaybooksController` API) be packaged as a Claude Code Skill, or handled another way?

**Recommendation given: package it as a Skill, with the mechanism decided now but the Skill's actual content deliberately not authored in this planning pass** — it should be written and iteratively refined during Phase 4's 3-playbook pilot pass, then reused unchanged (or lightly extended for Phase 5/6's bespoke fields) through Phase 7.

Reasoning: reusability across ~28 separate bounded agent-task invocations (Phase 4 + Phase 7) is a close match to what Skills exist for — reliable discovery/loading per invocation, better than expecting each new session to find and re-read a `phases.md` paragraph. Honest limitation stated alongside the recommendation: a Skill doesn't mechanically enforce the checklist any more than a documentation file would; the real advantage is operational reliability and a clean separation between `phases.md` (why) and the Skill (how), not a stronger enforcement guarantee. Explicitly not premature to decide the *mechanism* now, but writing the Skill's *content* now would be — Phase 4's own newly-reframed purpose (per the Q9 resolution) is precisely to discover what that content should be.

Propagated to `docs/hunter-playbooks/phases.md` Phase 4 (purpose reframed to include pattern-validation, Skill added as an explicit deliverable), Phase 6/7 (inherit/extend the Skill), `docs/hunter-playbooks/architecture.md` Section 4, `docs/hunter-playbooks/open-questions.md` Q9 (resolved) and Q10 (new — recommendation given, not yet Skyler-confirmed, flagged as such rather than marked "Resolved").

## Why

Skyler explicitly asked for a directional recommendation on the mechanism, not an options list, citing my first-hand operational knowledge of what a Skill is in this environment. Full reasoning: `docs/hunter-playbooks/open-questions.md` Q10.
