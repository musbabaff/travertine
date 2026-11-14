// Fails when README.md and README.tr.md drift apart in structure (headings, code blocks, tables, images).
// Both files must be updated in the same pull request (CONTRIBUTING.md).
import { readFileSync } from "node:fs";

const count = (s, re) => (s.match(re) || []).length;
const shape = (file) => {
  const s = readFileSync(file, "utf8");
  return {
    h2: count(s, /^## /gm),
    h3: count(s, /^### /gm),
    code: count(s, /^```/gm),
    tables: count(s, /^\|---/gm),
    images: count(s, /<img |!\[/g),
  };
};

const en = shape("README.md");
const tr = shape("README.tr.md");
let failed = false;
for (const k of Object.keys(en)) {
  const ok = en[k] === tr[k];
  if (!ok) failed = true;
  console.log(`${ok ? "ok  " : "FAIL"}  ${k.padEnd(7)} en=${en[k]} tr=${tr[k]}`);
}
if (failed) {
  console.error("README.md and README.tr.md differ in structure. Update both files together.");
  process.exit(1);
}
