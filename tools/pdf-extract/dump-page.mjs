// Diagnostic script: dumps raw pdf.js text items for a given page, including
// resolved font info, so we can figure out how bold/italic is signaled in
// this specific PDF's font set before writing the real extractor.
//
// Usage: node dump-page.mjs <pdfPath> <pageNumber>

import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import fs from "node:fs";

const [, , pdfPath, pageNumArg] = process.argv;
if (!pdfPath || !pageNumArg) {
  console.error("Usage: node dump-page.mjs <pdfPath> <pageNumber>");
  process.exit(1);
}
const pageNum = Number(pageNumArg);

const data = new Uint8Array(fs.readFileSync(pdfPath));
const doc = await getDocument({ data, useSystemFonts: true }).promise;
const page = await doc.getPage(pageNum);
const textContent = await page.getTextContent({
  includeMarkedContent: false,
});

const fontCache = new Map();
function resolveFont(fontName) {
  if (fontCache.has(fontName)) return fontCache.get(fontName);
  let info = null;
  try {
    const obj = page.commonObjs.get(fontName);
    info = obj
      ? {
          name: obj.name,
          fallbackName: obj.fallbackName,
          bold: obj.bold,
          italic: obj.italic,
        }
      : null;
  } catch {
    info = null;
  }
  fontCache.set(fontName, info);
  return info;
}

const rows = textContent.items
  .filter((it) => typeof it.str === "string")
  .map((it) => {
    const font = resolveFont(it.fontName);
    return {
      str: it.str,
      x: Math.round(it.transform[4] * 100) / 100,
      y: Math.round(it.transform[5] * 100) / 100,
      w: Math.round(it.width * 100) / 100,
      fontName: it.fontName,
      resolvedName: font?.name,
      hasEOL: it.hasEOL,
    };
  });

for (const r of rows) {
  console.log(JSON.stringify(r));
}
