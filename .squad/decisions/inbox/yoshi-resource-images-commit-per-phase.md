# Resource Images: commit per phase on one feature branch

**What:** Resource Images lands as one commit per completed phase (Phases 1–8) on a single feature branch. Skyler reviews and merges to `main` manually. Each commit must pass its per-phase gate (backend: build + tests; frontend: build + tests + relevant UI check) before the next phase starts. No intermediate PR between backend and frontend. Feature-branch name is still open.

**Why:** Skyler's answer to the merge-checkpoint question ("I want to commit after each phase on the current branch and I'll review the state of things before manually merging"). Railway verification is deferred to post-deploy, so the backend-first PR argument no longer holds. Gating each commit keeps a broken phase from being stacked under later ones.
