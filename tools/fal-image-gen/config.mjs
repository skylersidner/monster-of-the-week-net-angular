// Style anchor shared by every generation, regardless of model or subject. This is the exact
// wording Skyler has been using directly in fal.ai's own UI to get the results they want —
// verified there before this tool existed, so don't "improve" the phrasing.
// Combined with a per-call --subject at generation time, or used alone via --prompt override.
export const BASELINE_PROMPT =
  'A black and white "sketch" style. Inspired by Monster of the Week art in the handbook. ' +
  'Hand-drawn. No text except for the name.';

// No fal.ai model tried so far can be told to natively output WebP at a guaranteed exact size, so
// the target size/format is always applied locally, after download, not requested from the model
// — see generate.mjs. 1024x1024 was settled on (over an initial 800x800 candidate) after a real
// size/cost comparison across all three models on 2026-09-26: WebP re-encoding keeps every model
// under ~200KB even at 1024, and 1024 also matches the fixed-square-source assumption already
// baked into docs/resource-images/design.md, so no future update to that doc is needed.
export const OUTPUT_DEFAULTS = {
  width: 1024,
  height: 1024,
  format: 'webp',
};

// Model aliases -> fal.ai model id + the input this tool always sends it. Each model gets asked
// for the largest clean square it supports; generate.mjs downsizes from there.
export const MODELS = {
  seedream: {
    id: 'bytedance/seedream/v5/pro/text-to-image',
    input: (prompt) => ({ prompt, image_size: 'square_hd', output_format: 'png' }),
  },
  qwen: {
    id: 'fal-ai/qwen-image',
    input: (prompt) => ({ prompt, image_size: 'square_hd', output_format: 'png' }),
  },
  gptimage: {
    id: 'openai/gpt-image-2',
    input: (prompt) => ({ prompt, image_size: 'square_hd', output_format: 'png', quality: 'high' }),
    quality: 'high',
  },
};

// fal.ai's API does not return the actual amount billed for a request (checked directly against
// their docs, 2026-09-26) — so this is an ESTIMATE computed from each model's published per-image
// pricing at that same date, applied to the source image's actual returned dimensions. It will
// drift if fal.ai changes prices; re-check the model's pricing tab on fal.ai/models/<id> if a
// logged estimate looks obviously wrong.
export function estimateCostUsd(modelKey, image, modelDef) {
  const width = image?.width;
  const height = image?.height;
  if (!width || !height) {
    return { amountUsd: null, basis: 'source image dimensions unavailable' };
  }
  const area = width * height;

  switch (modelKey) {
    case 'seedream': {
      if (area <= 1536 * 1536) return { amountUsd: 0.0675, basis: 'published rate, area ≤ 1536x1536' };
      if (area <= 2048 * 2048) return { amountUsd: 0.135, basis: 'published rate, area ≤ 2048x2048' };
      return { amountUsd: null, basis: `no published rate covers area ${area}px²` };
    }
    case 'qwen': {
      const megapixels = Math.ceil(area / 1_000_000);
      return {
        amountUsd: Number((megapixels * 0.02).toFixed(4)),
        basis: `published rate, $0.02/MP × ${megapixels}MP (billed rounded up)`,
      };
    }
    case 'gptimage': {
      // fal.ai's published table only lists these exact sizes; no interpolation attempted.
      const table = {
        '1024x768': { low: 0.005, medium: 0.037, high: 0.145 },
        '1024x1024': { low: 0.006, medium: 0.053, high: 0.211 },
        '1024x1536': { low: 0.005, medium: 0.042, high: 0.165 },
        '1920x1080': { low: 0.005, medium: 0.04, high: 0.158 },
        '2560x1440': { low: 0.007, medium: 0.056, high: 0.222 },
        '3840x2160': { low: 0.012, medium: 0.101, high: 0.401 },
      };
      const quality = modelDef?.quality ?? 'high';
      const row = table[`${width}x${height}`];
      if (row?.[quality] !== undefined) {
        return { amountUsd: row[quality], basis: `published rate, ${width}x${height} at quality=${quality}` };
      }
      return { amountUsd: null, basis: `no published rate for ${width}x${height} at quality=${quality}` };
    }
    default:
      return { amountUsd: null, basis: 'no pricing data recorded for this model' };
  }
}
