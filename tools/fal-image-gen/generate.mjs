#!/usr/bin/env node
// Generates images via fal.ai and writes them locally at a fixed size/format. By default, runs
// every model in config.mjs's MODELS on the same prompt in parallel (one fal.ai's worth of
// randomness per model is the point of a comparison run) — pass --model to run just one.
//
// Usage:
//   node --env-file=.env generate.mjs --subject "..." --name swamp-thing        # all models
//   node --env-file=.env generate.mjs --model seedream --subject "..." --name swamp-thing
//   node --env-file=.env generate.mjs --model gptimage --prompt "full raw prompt" --name test
//
// See README.md for the full option list and per-model notes.

import { parseArgs } from 'node:util';
import { mkdir, writeFile, appendFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fal } from '@fal-ai/client';
import sharp from 'sharp';
import { BASELINE_PROMPT, MODELS, OUTPUT_DEFAULTS, estimateCostUsd } from './config.mjs';

const LOG_PATH = path.join(import.meta.dirname, 'log.jsonl');
const MODEL_KEYS = Object.keys(MODELS);

async function logInvocation(entry) {
  await appendFile(LOG_PATH, JSON.stringify(entry) + '\n');
}

const SHARP_ENCODERS = {
  webp: (img) => img.webp(),
  png: (img) => img.png(),
  jpeg: (img) => img.jpeg(),
  jpg: (img) => img.jpeg(),
};

function printUsage() {
  console.log(`Usage: node --env-file=.env generate.mjs --name <output-name> [options]

Required:
  --name,  -n    Output filename stem, no extension (e.g. "swamp-thing")

One of these (optional; baseline alone is used if neither is given):
  --subject, -s  Subject-specific description; combined with the baseline style prompt
  --prompt,  -p  Full raw prompt, used as-is instead of --subject + baseline

Optional:
  --model, -m    Which fal.ai model to use (${MODEL_KEYS.join(', ')}). Default: all of them, run
                 in parallel, one file per model (--name gets a "-<model>" suffix in that case).
  --width        Output width in px (default ${OUTPUT_DEFAULTS.width})
  --height       Output height in px (default ${OUTPUT_DEFAULTS.height})
  --format       Output format: webp, png, or jpeg (default ${OUTPUT_DEFAULTS.format}; falls back to png if the requested format fails to encode)
  --out-dir      Directory to write into (default ./output)
`);
}

const { values } = parseArgs({
  options: {
    model: { type: 'string', short: 'm' },
    subject: { type: 'string', short: 's' },
    prompt: { type: 'string', short: 'p' },
    name: { type: 'string', short: 'n' },
    width: { type: 'string' },
    height: { type: 'string' },
    format: { type: 'string' },
    'out-dir': { type: 'string' },
    help: { type: 'boolean', short: 'h' },
  },
});

if (values.help) {
  printUsage();
  process.exit(0);
}

if (!values.name) {
  console.error('Error: --name is required.\n');
  printUsage();
  process.exit(1);
}

const runAll = !values.model || values.model === 'all';
const modelKeys = runAll ? MODEL_KEYS : [values.model];
for (const key of modelKeys) {
  if (!MODELS[key]) {
    console.error(`Error: unknown model "${key}". Available: ${MODEL_KEYS.join(', ')}`);
    process.exit(1);
  }
}

const format = (values.format ?? OUTPUT_DEFAULTS.format).toLowerCase();
if (!SHARP_ENCODERS[format]) {
  console.error(`Error: unknown format "${format}". Available: ${Object.keys(SHARP_ENCODERS).join(', ')}`);
  process.exit(1);
}

if (!process.env.FAL_KEY) {
  console.error(
    'Error: FAL_KEY is not set. Put it in tools/fal-image-gen/.env (FAL_KEY=...) and run with ' +
      '`node --env-file=.env generate.mjs ...`, or export FAL_KEY in your shell.'
  );
  process.exit(1);
}

const prompt = values.prompt
  ? values.prompt
  : values.subject
    ? `${values.subject}\n\n${BASELINE_PROMPT}`
    : BASELINE_PROMPT;
const promptMode = values.prompt ? 'prompt-override' : values.subject ? 'subject+baseline' : 'baseline-only';

const width = Number(values.width ?? OUTPUT_DEFAULTS.width);
const height = Number(values.height ?? OUTPUT_DEFAULTS.height);
const outDir = values['out-dir'] ?? path.join(import.meta.dirname, 'output');

console.log(`Prompt: ${prompt.replace(/\n+/g, ' ')}`);
console.log(`Models: ${modelKeys.join(', ')}\n`);

async function generateOne(modelKey) {
  const modelDef = MODELS[modelKey];
  const tag = `[${modelKey}]`;
  const outName = modelKeys.length > 1 ? `${values.name}-${modelKey}` : values.name;
  const startedAt = new Date();
  const startTime = performance.now();
  const baseLogEntry = { timestamp: startedAt.toISOString(), model: modelKey, modelId: modelDef.id, promptMode, prompt };
  const elapsed = () => Math.round(performance.now() - startTime);

  let result;
  try {
    result = await fal.subscribe(modelDef.id, { input: modelDef.input(prompt), logs: false });
  } catch (err) {
    await logInvocation({ ...baseLogEntry, success: false, durationMs: elapsed(), error: err.message });
    return { modelKey, success: false, error: `fal.ai request failed: ${err.message}` };
  }

  const image = result.data?.images?.[0];
  if (!image?.url) {
    await logInvocation({ ...baseLogEntry, success: false, durationMs: elapsed(), error: 'fal.ai returned no image' });
    return { modelKey, success: false, error: 'fal.ai returned no image' };
  }

  console.log(`${tag} downloading...`);
  const response = await fetch(image.url);
  if (!response.ok) {
    await logInvocation({ ...baseLogEntry, success: false, durationMs: elapsed(), error: `download failed, HTTP ${response.status}` });
    return { modelKey, success: false, error: `download failed, HTTP ${response.status}` };
  }
  const sourceBuffer = Buffer.from(await response.arrayBuffer());

  // The API's own reported width/height is not reliable across models (fal.ai's Seedream v5 Pro
  // response omits it, contrary to its docs) — read the real dimensions back from the downloaded
  // bytes instead, which is always accurate.
  const sourceMeta = await sharp(sourceBuffer).metadata();
  const sourceDims = { width: sourceMeta.width, height: sourceMeta.height };

  await mkdir(outDir, { recursive: true });

  async function encodeAndWrite(fmt) {
    const outPath = path.join(outDir, `${outName}.${fmt}`);
    const encoded = await SHARP_ENCODERS[fmt](sharp(sourceBuffer).resize(width, height)).toBuffer();
    await writeFile(outPath, encoded);
    return outPath;
  }

  let outPath;
  let usedFormat = format;
  try {
    outPath = await encodeAndWrite(format);
  } catch (err) {
    if (format === 'png') {
      await logInvocation({ ...baseLogEntry, success: false, durationMs: elapsed(), error: `png encode failed: ${err.message}` });
      return { modelKey, success: false, error: `png encode failed: ${err.message}` };
    }
    console.warn(`${tag} encoding as ${format} failed (${err.message}); falling back to png.`);
    usedFormat = 'png';
    outPath = await encodeAndWrite('png');
  }

  const fileSizeBytes = (await stat(outPath)).size;
  const durationMs = elapsed();
  const cost = estimateCostUsd(modelKey, sourceDims, modelDef);

  await logInvocation({
    ...baseLogEntry,
    success: true,
    durationMs,
    sourceWidth: sourceDims.width,
    sourceHeight: sourceDims.height,
    outputWidth: width,
    outputHeight: height,
    outputFormat: usedFormat,
    outputPath: path.relative(import.meta.dirname, outPath),
    fileSizeBytes,
    seed: result.data.seed ?? null,
    requestId: result.requestId ?? null,
    estimatedCostUsd: cost.amountUsd,
    costBasis: cost.basis,
  });

  return {
    modelKey,
    success: true,
    outPath,
    durationMs,
    fileSizeBytes,
    sourceDims,
    seed: result.data.seed ?? null,
    cost,
  };
}

const results = await Promise.all(modelKeys.map(generateOne));

console.log('\n--- Results ---');
for (const r of results) {
  if (r.success) {
    const kb = (r.fileSizeBytes / 1024).toFixed(0);
    const costStr = r.cost.amountUsd !== null ? `~$${r.cost.amountUsd.toFixed(4)}` : `cost unknown (${r.cost.basis})`;
    console.log(
      `[${r.modelKey}] OK  ${r.outPath} — ${width}x${height}, ${kb}KB, source ${r.sourceDims.width}x${r.sourceDims.height}, ` +
        `${(r.durationMs / 1000).toFixed(1)}s, ${costStr}, seed=${r.seed ?? 'n/a'}`
    );
  } else {
    console.log(`[${r.modelKey}] FAIL ${r.error}`);
  }
}

const successCount = results.filter((r) => r.success).length;
console.log(`\n${successCount}/${results.length} succeeded.`);
if (successCount === 0) process.exit(1);
