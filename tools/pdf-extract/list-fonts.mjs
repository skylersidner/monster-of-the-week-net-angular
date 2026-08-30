// Diagnostic: for each page in a range, list the distinct fontName -> resolved
// PDF font descriptor (name/bold/italic) pdf.js reports, so we can build a
// stable style-classification table for this specific PDF's font set.
//
// Usage: node list-fonts.mjs <pdfPath> <firstPage> <lastPage>

import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import fs from "node:fs";

const [, , pdfPath, firstArg, lastArg] = process.argv;
const first = Number(firstArg);
const last = Number(lastArg);

const data = new Uint8Array(fs.readFileSync(pdfPath));
const doc = await getDocument({ data, useSystemFonts: true }).promise;

const seen = new Map();

for (let p = first; p <= last; p++) {
  const page = await doc.getPage(p);
  await page.getOperatorList(); // forces font objects to resolve into commonObjs
  const textContent = await page.getTextContent();
  for (const it of textContent.items) {
    if (!it.fontName || seen.has(it.fontName)) continue;
    let obj = null;
    try {
      obj = page.commonObjs.get(it.fontName);
    } catch {
      obj = null;
    }
    seen.set(it.fontName, {
      name: obj?.name,
      fallbackName: obj?.fallbackName,
      bold: obj?.bold,
      italic: obj?.italic,
      keys: obj ? Object.keys(obj) : null,
    });
  }
}

for (const [k, v] of seen) {
  console.log(k, JSON.stringify(v));
}
