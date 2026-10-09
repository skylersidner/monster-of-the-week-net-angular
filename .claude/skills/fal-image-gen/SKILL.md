---
name: fal-image-gen
description: Generate a black-and-white "sketch" style image via fal.ai across all three of Skyler's chosen models (Seedream v5 Pro, Qwen Image, GPT Image 2) in one call, resized/re-encoded locally to a consistent 1024x1024 WebP (PNG fallback). Use when Skyler asks to generate, sketch, draw, or create art for a monster, bystander, hunter, or location. Purely local — does not touch the app, its database, or any resource record.
---

# Generating a character-sketch image via fal.ai

Thin wrapper around `tools/fal-image-gen/` — a standalone Node tool, not part of the app. See
that directory's `README.md` for the full design rationale (why size/format is enforced locally
rather than via model parameters). This skill is deliberately generic: prompt in, image file out.
It has no concept of monsters/bystanders/resource records — if the app ever grows an "attach
generated image to this resource" feature, that is a separate, later piece of work (see
`docs/resource-images/design.md` for the in-flight, not-yet-built app-side design).

## Before running

1. **Check `tools/fal-image-gen/.env` exists and has a real `FAL_KEY`.** If it's missing, tell
   Skyler to copy `.env.example` to `.env` and paste their fal.ai key in — do not ask them to
   paste the key into chat. `generate.mjs` fails fast with a clear message if the key is unset;
   surface that message verbatim rather than guessing at the cause.
2. **Get the subject.** If Skyler hasn't already given a specific description (appearance,
   notable features, the character's name so it can render in the art per the baseline prompt),
   ask for one rather than inventing details. This becomes `--subject`.

## Running it

From `tools/fal-image-gen/`:

```bash
node --env-file=.env generate.mjs --subject "<physical description, distinguishing features, and the character's name>" --name <kebab-case-slug>
```

**Default behavior is all three models, run in parallel, producing three files** — this is
deliberate, not a comparison-mode opt-in: Skyler wants the variety in how each model handles
layout, framing, and name placement every time, not just one settled "answer." Only pass
`--model <seedream|qwen|gptimage>` when Skyler explicitly asks for a single model.

- `--name` is the output filename stem (no extension). With all three models running, each file
  gets an automatic `-<model>` suffix (e.g. `swamp-thing-seedream.webp`); pick a base name
  identifying the subject and let the suffixing happen.
- Do not pass `--width`/`--height`/`--format` unless Skyler asks for something other than the
  1024x1024 WebP default (settled 2026-09-26 after comparing file sizes across models) — those
  exist for one-off overrides, not routine use.
- If Skyler gives a complete, ready-to-use prompt of their own (rather than a subject to combine
  with the baseline style), use `--prompt` instead of `--subject` to send it as-is.

The script prints a per-model result line — output path, size, response time, estimated cost, or
a failure reason — and keeps going past any individual model's failure; a run that's 2-for-3 still
produced two usable files. Relay the printed failure reason for any model that didn't succeed
rather than guessing at the cause or silently retrying.

Every run — success or failure — is also appended to `tools/fal-image-gen/log.jsonl` (prompt,
model, timestamp, response time, estimated cost, output path, seed/request id). Nothing extra
needs to be done to maintain this; `generate.mjs` writes it automatically.

## After it succeeds

**Show every result.** Read each saved file (the paths `generate.mjs` printed, one per succeeding
model) with the Read tool so all of them render inline in the conversation — don't just report the
file paths and stop there. Skyler wants to see and compare all three, not pick one for them.

If Skyler asks to iterate (different pose, different framing, tweak the prompt), re-run with an
adjusted `--subject`/`--prompt` and a new `--name` rather than overwriting the previous file, so
earlier attempts stay around for comparison until Skyler says to clean them up.

## Adjusting the baseline style or models

If Skyler wants to change the shared style prompt, add a model, or change the default output
size/format, those all live in `tools/fal-image-gen/config.mjs` — edit that file directly rather
than passing overrides on every call.
