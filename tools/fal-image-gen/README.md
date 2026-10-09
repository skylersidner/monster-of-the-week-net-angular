# fal.ai image generation — spike/POC tool

Standalone, one-off tooling. **Not a dependency of the deployed app** — this
directory has its own `package.json`/`node_modules`, separate from
`src/web`'s. Nothing here is wired into the Angular or .NET build, and it
does not touch the app's database or API.

Purpose: generate "character sketch" style images via fal.ai from a shared
baseline style prompt plus a per-call subject, across all three models
Skyler has had success with, and land them locally at a consistent size and
format. **By default, one invocation produces three files — one per
model, run in parallel** — because the point of this tool is comparing them,
not picking one upfront. Each model interprets the "no text except the
name" instruction differently (a signature, a title card, a full reference
sheet), which is deliberately kept as variety rather than normalized away.

## Why post-processing, not model parameters, controls size/format

Every model tried so far tops out at PNG/JPEG and can't be told to produce
an exact square at an arbitrary size:

- `bytedance/seedream/v5/pro/text-to-image` — PNG/JPEG only; **cannot
  generate below 1024x1024 total pixels at all**, and always generates at
  2048x2048 when asked for `square_hd`.
- `fal-ai/qwen-image` — PNG/JPEG only.
- `openai/gpt-image-2` — the only one with native WebP, but its own pixel-
  count floor still can't hit an arbitrary exact square.

So `generate.mjs` always asks each model for the largest clean square it
supports (`image_size: "square_hd"`), downloads that, and resizes +
re-encodes to the target size/format locally with `sharp`. This is one
shared step regardless of which model produced the source image, and stays
correct if a fourth model is added later.

**Settled 2026-09-26: the target size is 1024x1024, not the initially-
proposed 800x800.** A real comparison across all three models found WebP
re-encoding keeps every model under ~200KB even at 1024 — the format change
does the real work, not the downscale — and 1024 also matches the
fixed-square-source assumption already in `docs/resource-images/design.md`,
so this choice needs no future update to that doc.

## Setup

```
npm install
cp .env.example .env
# then put your real key in .env: FAL_KEY=...
```

`.env` is git-ignored (matched by the repo's root `.gitignore` `.env` rule).
Never commit a real key.

## Usage

```
node --env-file=.env generate.mjs --subject "A hulking swamp monster, vines wrapped around a humanoid frame, holding a rusted cleaver. Name: Swamp Thing" --name swamp-thing
```

This runs all three models in parallel and writes `output/swamp-thing-seedream.webp`,
`output/swamp-thing-qwen.webp`, and `output/swamp-thing-gptimage.webp`. Pass `--model` to run
just one instead (in which case `--name` is used as-is, no suffix):

```
node --env-file=.env generate.mjs --model seedream --subject "..." --name swamp-thing
```

- `--model` — `seedream` | `qwen` | `gptimage` (see `config.mjs` for the
  exact fal.ai model id each one calls). Omit it (or pass `all`) to run
  every model — the default, since comparing them is the point.
- `--name` — output filename stem, no extension.
- `--subject` — the monster/character-specific description. Combined with
  the shared `BASELINE_PROMPT` from `config.mjs` (the "black and white
  sketch style... hand-drawn... no text except the name" style anchor).
- `--prompt` — full raw prompt, used as-is instead of `--subject` +
  baseline, for when you want complete control.
- `--width` / `--height` — override the 1024x1024 default.
- `--format` — `webp` (default) | `png` | `jpeg`. Falls back to `png`
  automatically if the requested format fails to encode.
- `--out-dir` — override the default `./output/` (git-ignored).

Run `node generate.mjs --help` for the full option list. A multi-model run
prints a per-model result line (or failure reason) and continues past any
individual model's failure — a run that's 2-for-3 still writes the 2 that
succeeded.

## Usage log

Every invocation — success or failure — appends one line to `log.jsonl` (git-ignored, local
only): timestamp, model, the exact resolved prompt, response time in ms, the source image's
native size and the final output's size/format/path, the seed and fal.ai request id when
available, and an **estimated** cost in USD.

That cost figure is computed locally from each model's published per-image pricing
(`estimateCostUsd` in `config.mjs`), applied to the source image's actual returned dimensions —
**fal.ai's API does not return the actual billed amount for a request**, checked directly against
their docs. Treat it as a good-enough estimate for tracking spend, not a receipt; it will drift if
fal.ai changes prices, and a `null` value with a `costBasis` explaining why (e.g. an unrecognized
GPT Image 2 size) means no published rate matched.

## Editing the baseline style prompt or adding a model

Both live in `config.mjs`:

- `BASELINE_PROMPT` — the shared style anchor appended to every `--subject`
  call.
- `MODELS` — alias -> `{ id, input(prompt) }`. `input` is a function so a
  model needing different parameters (e.g. a `quality` field) isn't forced
  into the same shape as the others.
- `OUTPUT_DEFAULTS` — the 1024x1024/webp defaults.

This tool intentionally has no knowledge of monsters/bystanders/locations
or the app's data model — it is prompt-in, image-out. Wiring generated
images to a specific resource (filename conventions, app upload, etc.) is
a separate, later decision — see `docs/resource-images/design.md` for the
in-flight (not-yet-built) app-side design this may eventually feed.
