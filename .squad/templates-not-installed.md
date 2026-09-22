# `.squad/templates/` is not installed in this repo

**If an instruction told you to read a file under `.squad/templates/`, that file does not exist and never has. This is a known gap, not an error you caused and not something to stop for.**

`.github/agents/squad.agent.md` (Squad v0.9.1) contains **18 references to 13 files** in a `.squad/templates/` directory that was never part of this repository — it has never been committed on any branch, and there is no Squad framework source on this machine to restore it from.

## Why it is missing

Squad was built for GitHub Copilot. This project adapted it for Claude Code, and parts of the framework did not map across one-to-one. The reference templates are one of those parts. That was a deliberate adaptation rather than a broken install.

## What to do when you hit one of those pointers

**Improvise from the surrounding instructions, and say in your report that you did.** The pointers are all "on-demand reference" lazy loads — `squad.agent.md`'s own Source of Truth table describes the directory as *"Reference. Format guides for runtime files. Not authoritative for enforcement."* Nothing structural depends on them, so the runtime file you were about to write can be written without its format guide. Match the conventions of the existing files of that kind instead; they are the real authority here.

Do not treat a missing template as a blocker, and do not report it as a defect — it is recorded here. **Do say which pointer you hit**, so this note can name the ones that actually come up.

## The pointers, and what they were for

Most are tied to framework features this project has never used, which is why the gap stayed invisible for months:

| Referenced file | Feature | Used here? |
|---|---|---|
| `ceremony-reference.md` | Ceremony config format and facilitator spawn template | **Yes** — ceremonies run from `.squad/ceremonies.md` instead |
| `skill.md` | `SKILL.md` format guide | **Yes** — follow `.squad/skills/*/SKILL.md` as the pattern |
| `orchestration-log.md` | Field format for orchestration log entries | **Yes** — follow existing entries in `.squad/orchestration-log/` |
| `casting-policy.json`, `casting-reference.md` | Agent casting and naming | Init-mode only; already done |
| `mcp-config.md` | MCP config locations and auth notes | No |
| `multi-agent-format.md` | Multi-agent artifact assembly | No |
| `constraint-tracking.md` | Constraint counters | No |
| `ralph-reference.md` | Ralph's work-check board | No |
| `issue-lifecycle.md` | Issue → PR → merge flow | No |
| `prd-intake.md` | PRD intake and decomposition | No |
| `plugin-marketplace.md` | Plugin marketplace state | No |
| `human-members.md` | Human team members | No |
| `copilot-agent.md` | Adding @copilot as a member | No — Copilot is not used here |

## Why the references were not simply deleted

`.github/agents/squad.agent.md` is stamped `version: 0.9.1` and is rewritten by the framework on install or upgrade, so edits to it are temporary and diverge this copy from upstream. This note costs nothing, survives an upgrade, and should be **deleted** the moment a real `.squad/templates/` is installed.

---

*Recorded 2026-09-21, from the mystery-entity-linking retrospective. The same broken-pointer class as the retired `.squad/decisions.md` — see `.squad/decisions/README.md` §9, and `docs/engineering-practice-improvements-plan.md` for the wider finding that a dead pointer fails silently.*
