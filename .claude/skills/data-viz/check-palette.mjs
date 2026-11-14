// Verifies that UI and chart colours meet their WCAG contrast targets.
// Reads the tokens straight from apps/web/src/app/globals.css so the check can never drift from the app.
// Usage: node .claude/skills/data-viz/check-palette.mjs   (exits 1 on failure)
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../../apps/web/src/app/globals.css"), "utf8");
const root = css.slice(css.indexOf(":root"), css.indexOf("}", css.indexOf(":root")));
const tokens = Object.fromEntries([...root.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\b/g)].map((m) => [m[1], m[2]]));

// [foreground token or hex, background token or hex, minimum ratio, note]
const checks = [
  ...["color-ink", "color-ink-2", "color-ink-muted", "color-teal-700", "color-accent", "color-danger", "color-warning"].flatMap((t) => [
    [t, "color-canvas", 4.5, "text on canvas"],
    [t, "color-surface", 4.5, "text on surface"],
  ]),
  ["color-warning", "color-warning-bg", 4.5, "warning text on its banner"],
  ["#ffffff", "color-teal-700", 4.5, "button label"],
  ["#ffffff", "color-teal-600", 4.5, "button label on hover"],
  ["color-border-strong", "color-canvas", 3, "UI boundary"],
  ["color-teal-500", "color-canvas", 3, "UI graphic"],
  ...["viz-water", "viz-income", "viz-soil", "viz-risk", "viz-model", "viz-neutral"].map((t) => [t, "color-canvas", 3, "chart mark"]),
  ["color-brand-teal", "color-brand-paper", 1, "brand mark only, never text (reported, not enforced)"],
];

const hex = (v) => (v.startsWith("#") ? v : tokens[v]);
const lum = (h) => {
  const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

let failed = 0;
for (const [fg, bg, min, note] of checks) {
  const [f, b] = [hex(fg), hex(bg)];
  if (!f || !b) {
    console.log(`FAIL  missing token ${!f ? fg : bg}`);
    failed++;
    continue;
  }
  const r = ratio(f, b);
  const ok = r >= min;
  if (!ok) failed++;
  console.log(`${ok ? "pass" : "FAIL"}  ${`${fg} on ${bg}`.padEnd(42)} ${r.toFixed(2)} (min ${min}) ${note}`);
}
process.exit(failed ? 1 : 0);
