// Verifies that chart and UI colours meet their WCAG contrast targets against the canvas.
// Usage: node .claude/skills/data-viz/check-palette.mjs   (exits 1 on failure)

const canvas = "#F5F1E8";

// [name, hex, minimum ratio]
const checks = [
  ["ink", "#0F1B2D", 4.5],
  ["ink-2", "#5C5446", 4.5],
  ["ink-muted", "#6B6252", 4.5],
  ["teal-700", "#13615F", 4.5],
  ["accent", "#A84B14", 4.5],
  ["danger", "#A63D32", 4.5],
  ["warning", "#8A5A00", 4.5],
  ["border-strong", "#8C7F68", 3],
  ["teal-500", "#2A9490", 3],
  ["viz-water", "#0072B2", 3],
  ["viz-income", "#B87800", 3],
  ["viz-soil", "#007A5A", 3],
  ["viz-risk", "#C1480A", 3],
  ["viz-neutral", "#8C7F68", 3],
];

const lum = (hex) => {
  const c = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

let failed = 0;
for (const [name, hex, min] of checks) {
  const r = ratio(hex, canvas);
  const ok = r >= min;
  if (!ok) failed++;
  console.log(`${ok ? "pass" : "FAIL"}  ${name.padEnd(14)} ${hex}  ${r.toFixed(2)} (min ${min})`);
}
process.exit(failed ? 1 : 0);
