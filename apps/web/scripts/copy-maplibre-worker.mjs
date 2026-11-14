// MapLibre GL 6 loads its web worker from a separate module file that bundlers do not emit.
// Copy the installed version into public/ so it is served at /maplibre-gl-worker.mjs.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const dist = dirname(require.resolve("maplibre-gl/package.json"));
const pub = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
mkdirSync(pub, { recursive: true });
copyFileSync(join(dist, "dist", "maplibre-gl-worker.mjs"), join(pub, "maplibre-gl-worker.mjs"));
