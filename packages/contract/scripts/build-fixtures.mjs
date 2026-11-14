// Builds contract fixtures from raw downloads of public datasets.
// Raw inputs (not committed) are read from the directory given as the first argument:
//   power.json  NASA POWER monthly point API, AG community, PRECTOTCORR_SUM,T2M,T2M_MAX,T2M_MIN,GWETROOT
//   soil.json   ISRIC SoilGrids v2.0 properties query: clay,sand,silt,soc,phh2o, 0–100 cm, mean
//   ndvi.json   ORNL DAAC MODIS subset API, MOD13Q1 250m_16_days_NDVI, DOY 097–241 per year
//   crops.engine.json  GET /v1/crops from services/engine (FAO-56 values with per-crop citations)
//   field.engine.json  POST /v1/field/analyze from services/engine with fixtures/field-analyze.request.json
// Usage: node packages/contract/scripts/build-fixtures.mjs <raw-dir>
//
// Derived quantities and how they are computed are recorded in each provenance `note`.
// crops.json and the climate, soil, field_id and provenance of field-analyze.json are engine output verbatim.
// Model outputs (rotation scores, modelled stress) are NOT produced by the engine yet; see the notes.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const raw = process.argv[2];
if (!raw) throw new Error("usage: build-fixtures.mjs <raw-dir>");
const load = (f) => JSON.parse(readFileSync(join(raw, f), "utf8"));
const out = (f, data) =>
  writeFileSync(new URL(`../fixtures/${f}`, import.meta.url), JSON.stringify(data, null, 2) + "\n");
const r = (x, d = 1) => Math.round(x * 10 ** d) / 10 ** d;

const LAT = 37.89;
const LON = 28.98;
const YEARS = Array.from({ length: 24 }, (_, i) => 2001 + i);

// ---------- climate (NASA POWER) ----------
const power = load("power.json").properties.parameter;
const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

// FAO-56 eq. 21: extraterrestrial radiation Ra (MJ m-2 day-1) for the mid-month day
function ra(latDeg, doy) {
  const phi = (latDeg * Math.PI) / 180;
  const dr = 1 + 0.033 * Math.cos((2 * Math.PI * doy) / 365);
  const delta = 0.409 * Math.sin((2 * Math.PI * doy) / 365 - 1.39);
  const ws = Math.acos(-Math.tan(phi) * Math.tan(delta));
  return ((24 * 60) / Math.PI) * 0.082 * dr * (ws * Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.sin(ws));
}
// Hargreaves–Samani (FAO-56 eq. 52), mm/day; 0.408 converts MJ m-2 to mm
const hargreaves = (tmean, tmax, tmin, raMJ) => 0.0023 * (tmean + 17.8) * Math.sqrt(Math.max(tmax - tmin, 0)) * 0.408 * raMJ;

const monthly = (y) =>
  DAYS.map((days, m) => {
    const k = `${y}${String(m + 1).padStart(2, "0")}`;
    const doy = DAYS.slice(0, m).reduce((a, b) => a + b, 0) + 15;
    const et0 = hargreaves(power.T2M[k], power.T2M_MAX[k], power.T2M_MIN[k], ra(LAT, doy)) * days;
    return { m: m + 1, p: power.PRECTOTCORR_SUM[k], et0, t: power.T2M[k], w: power.GWETROOT[k] };
  });

// ---------- engine output ----------
const engineField = load("field.engine.json");
const engineCrops = load("crops.engine.json");
const climate = engineField.climate;
const pmByYear = Object.fromEntries(climate.map((c) => [c.year, c.et0_mm]));

// Monthly ET0 for the illustrative proxies below: the Hargreaves seasonal shape from POWER monthly
// temperatures, rescaled so each year's total equals the engine's FAO-56 Penman-Monteith annual ET0.
// (POWER monthly T2M_MAX/T2M_MIN are monthly extremes, so unscaled Hargreaves overstates ET0.)
const monthlyScaled = (y) => {
  const ms = monthly(y);
  const total = ms.reduce((a, x) => a + x.et0, 0);
  const k = pmByYear[y] / total;
  return ms.map((x) => ({ ...x, et0: x.et0 * k }));
};

// ---------- soil (SoilGrids + Saxton & Rawls 2006) ----------
const layers = Object.fromEntries(
  load("soil.json").properties.layers.map((l) => [l.name, l.depths.map((d) => ({ top: d.range.top_depth, bot: d.range.bottom_depth, v: d.values.mean / l.unit_measure.d_factor }))]),
);
const depthMean = (name, maxCm) => {
  let s = 0, w = 0;
  for (const d of layers[name]) if (d.bot <= maxCm) { s += d.v * (d.bot - d.top); w += d.bot - d.top; }
  return s / w;
};
const clay030 = depthMean("clay", 30), sand030 = depthMean("sand", 30), silt030 = depthMean("silt", 30);

function usdaTexture(sand, silt, clay) {
  if (silt + 1.5 * clay < 15) return "sand";
  if (silt + 1.5 * clay >= 15 && silt + 2 * clay < 30) return "loamy sand";
  if ((clay >= 7 && clay < 20 && sand > 52 && silt + 2 * clay >= 30) || (clay < 7 && silt < 50 && silt + 2 * clay >= 30)) return "sandy loam";
  if (clay >= 7 && clay < 27 && silt >= 28 && silt < 50 && sand <= 52) return "loam";
  if ((silt >= 50 && clay >= 12 && clay < 27) || (silt >= 50 && silt < 80 && clay < 12)) return "silt loam";
  if (silt >= 80 && clay < 12) return "silt";
  if (clay >= 20 && clay < 35 && silt < 28 && sand > 45) return "sandy clay loam";
  if (clay >= 27 && clay < 40 && sand > 20 && sand <= 45) return "clay loam";
  if (clay >= 27 && clay < 40 && sand <= 20) return "silty clay loam";
  if (clay >= 35 && sand > 45) return "sandy clay";
  if (clay >= 40 && silt >= 40) return "silty clay";
  return "clay";
}

// Saxton & Rawls (2006) eqs. 1–2; S, C as fractions, OM in %
function awcLayerMm(sandPct, clayPct, socGkg, thicknessCm) {
  const S = sandPct / 100, C = clayPct / 100, OM = (socGkg / 10) * 1.724;
  const t1500 = -0.024 * S + 0.487 * C + 0.006 * OM + 0.005 * S * OM - 0.013 * C * OM + 0.068 * S * C + 0.031;
  const w1500 = t1500 + (0.14 * t1500 - 0.02);
  const t33 = -0.251 * S + 0.195 * C + 0.011 * OM + 0.006 * S * OM - 0.027 * C * OM + 0.452 * S * C + 0.299;
  const w33 = t33 + (1.283 * t33 * t33 - 0.374 * t33 - 0.015);
  return (w33 - w1500) * thicknessCm * 10;
}
const awc = layers.clay.reduce((a, d, i) => a + awcLayerMm(layers.sand[i].v, d.v, layers.soc[i].v, d.bot - d.top), 0);

const soil = engineField.soil;
const localSoil = { texture: usdaTexture(sand030, silt030, clay030), organic_carbon: r(depthMean("soc", 30), 1), ph: r(depthMean("phh2o", 30), 1), awc_mm: Math.round(awc) };
if (JSON.stringify(localSoil) !== JSON.stringify(soil)) console.warn("engine soil differs from local derivation", { localSoil, soil });

// ---------- NDVI (MODIS MOD13Q1) ----------
const ndviRaw = load("ndvi.json");
const ndvi_history = YEARS.filter((y) => ndviRaw[y]?.length).map((year) => ({
  year,
  mean_ndvi: r(ndviRaw[year].reduce((a, x) => a + x.ndvi, 0) / ndviRaw[year].length, 3),
}));

// ---------- validation proxy ----------
// Growing-season (Apr–Sep) climatic water deficit 1 − P/ET0, a transparent proxy computed from POWER.
const seasonStress = Object.fromEntries(
  YEARS.map((y) => {
    const ms = monthlyScaled(y).filter((x) => x.m >= 4 && x.m <= 9);
    const p = ms.reduce((a, x) => a + x.p, 0), e = ms.reduce((a, x) => a + x.et0, 0);
    return [y, Math.min(1, Math.max(0, 1 - p / e))];
  }),
);
const nd = ndvi_history.map((d) => d.mean_ndvi);
const mu = nd.reduce((a, b) => a + b, 0) / nd.length;
const sd = Math.sqrt(nd.reduce((a, b) => a + (b - mu) ** 2, 0) / (nd.length - 1));
const vyears = ndvi_history.map((d) => ({ year: d.year, modelled_stress: r(seasonStress[d.year], 3), observed_ndvi_anomaly: r((d.mean_ndvi - mu) / sd, 2) }));
const pearson = (a, b) => {
  const ma = a.reduce((x, y) => x + y, 0) / a.length, mb = b.reduce((x, y) => x + y, 0) / b.length;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) { num += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return num / Math.sqrt(da * db);
};
const corr = pearson(vyears.map((v) => v.modelled_stress), vyears.map((v) => v.observed_ndvi_anomaly));

// ---------- provenance ----------
const first = YEARS[0], last = YEARS.at(-1);
const PROV = {
  power: {
    dataset: "NASA POWER monthly point data (MERRA-2 and GEWEX SRB derived), AG community",
    provider: "NASA Langley Research Center, POWER Project",
    spatial_resolution: "0.5° × 0.625°",
    temporal_coverage: `${first}–${last}, monthly`,
    access_url: "https://power.larc.nasa.gov/docs/services/api/temporal/monthly/",
    note: "Parameters PRECTOTCORR_SUM, T2M, T2M_MAX, T2M_MIN, GWETROOT. Annual ET0 is computed by summing monthly Hargreaves–Samani estimates (FAO-56 eq. 52) from POWER temperatures and FAO-56 extraterrestrial radiation; Hargreaves can overestimate ET0 in humid or windy conditions.",
  },
  soilgrids: {
    dataset: "SoilGrids 2.0 (clay, sand, silt, soc, phh2o)",
    provider: "ISRIC — World Soil Information",
    spatial_resolution: "250 m",
    temporal_coverage: "Static, predictions from soil profiles collected over several decades",
    access_url: "https://rest.isric.org/soilgrids/v2.0/docs",
    note: "Texture, organic carbon and pH are depth-weighted means of 0–30 cm. Available water capacity is the 0–100 cm sum of field capacity minus wilting point from the Saxton & Rawls (2006) pedotransfer functions. SoilGrids 90 % prediction intervals at this point are wide (clay 3–92 %), so soil values are uncertain.",
  },
  modis: {
    dataset: "MODIS/Terra Vegetation Indices 16-Day L3 Global 250 m (MOD13Q1 v061)",
    provider: "NASA LP DAAC, accessed via ORNL DAAC MODIS Web Service",
    spatial_resolution: "250 m",
    temporal_coverage: `${first}–${last}, 16-day composites, April–September`,
    access_url: "https://modis.ornl.gov/data/modis_webservice.html",
    note: "Single pixel at the field centre. Growing-season mean of the ten composites starting day-of-year 97 to 241. Quality flags not yet applied.",
  },
  fao56: {
    dataset: "FAO Irrigation and Drainage Paper No. 56 — Crop evapotranspiration",
    provider: "Food and Agriculture Organization of the United Nations",
    spatial_resolution: "Not spatial (crop coefficients)",
    temporal_coverage: "Published 1998",
    access_url: "https://www.fao.org/4/x0490e/x0490e00.htm",
    note: "Crop coefficients (Table 12) and rooting depths (Table 22).",
  },
};

// ---------- crops (engine output, FAO-56 with per-crop citations) ----------
const crops = engineCrops;
const cropById = Object.fromEntries(crops.map((c) => [c.id, c]));

// ---------- rotations (illustrative: simple Kc-weighted demand on the POWER climatology) ----------
// Mean monthly ET0 and precipitation across the record.
const clim = Array.from({ length: 12 }, (_, m) => {
  const v = YEARS.map((y) => monthlyScaled(y)[m]);
  return { et0: v.reduce((a, x) => a + x.et0, 0) / v.length, p: v.reduce((a, x) => a + x.p, 0) / v.length };
});
const SEASON_MONTHS = { winter: [10, 11, 12, 1, 2, 3, 4, 5, 6], summer: [4, 5, 6, 7, 8, 9, 10], perennial: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] };
function seasonWater(c) {
  const months = SEASON_MONTHS[c.season].slice(0, Math.max(1, Math.round(c.growing_days / 30.4)));
  const kcAvg = (c.kc_ini + 2 * c.kc_mid + c.kc_end) / 4;
  const demand = months.reduce((a, m) => a + clim[m - 1].et0 * kcAvg, 0);
  const effRain = months.reduce((a, m) => a + clim[m - 1].p * 0.8, 0);
  const store = Math.min(soil.awc_mm, soil.awc_mm * (c.root_depth_m / 1.0)) * 0.5;
  const deficit = Math.max(0, demand - effRain - store);
  return { demand: Math.round(demand), deficit: Math.round(deficit), stress: r(Math.min(1, deficit / demand), 2) };
}
const sequences = [
  ["winter_wheat", "lentil", "cotton", "winter_wheat"],
  ["winter_wheat", "lentil", "sunflower", "barley"],
  ["cotton", "winter_wheat", "soybean", "maize"],
  ["barley", "faba_bean", "winter_wheat", "sunflower"],
  ["maize", "cotton", "maize", "cotton"],
];
const rotations = sequences.map((sequence) => {
  const yearly = sequence.map((id, i) => {
    const w = seasonWater(cropById[id]);
    return { year_index: i + 1, crop_id: id, water_demand_mm: w.demand, water_deficit_mm: w.deficit, stress_index: w.stress };
  });
  const totalDef = yearly.reduce((a, y) => a + y.water_deficit_mm, 0);
  const legumes = sequence.filter((id) => cropById[id].is_legume).length;
  const families = new Set(sequence.map((id) => cropById[id].family)).size;
  const repeats = sequence.filter((id, i) => i > 0 && sequence[i - 1] === id).length;
  const meanStress = yearly.reduce((a, y) => a + y.stress_index, 0) / yearly.length;
  const water = r(1 - Math.min(1, totalDef / (sequence.length * 800)), 2);
  const soilScore = r(Math.min(1, 0.25 + 0.2 * legumes + 0.1 * families - 0.15 * repeats), 2);
  const risk = r(1 - meanStress * 0.8 - 0.05 * repeats, 2);
  const income = r(Math.min(1, 0.3 + 0.12 * sequence.filter((id) => ["cotton", "maize", "sugar_beet", "tomato"].includes(id)).length + 0.04 * (families - 1)), 2);
  return { sequence, scores: { water, income, soil: soilScore, risk }, yearly, legumes, totalDef };
});
const pr = JSON.parse(readFileSync(new URL("../fixtures/rotations-explore.request.json", import.meta.url), "utf8")).priorities;
const wsum = pr.water + pr.income + pr.soil + pr.risk;
for (const x of rotations) {
  x.scores.total = r((pr.water * x.scores.water + pr.income * x.scores.income + pr.soil * x.scores.soil + pr.risk * x.scores.risk) / wsum, 2);
  const names = x.sequence.map((id) => cropById[id].name.toLowerCase());
  x.explanation = [
    `Estimated water deficit over ${x.sequence.length} years: ${x.totalDef} mm under rain-fed conditions, using the 2001–2024 climate at this location.`,
    x.legumes ? `Includes ${x.legumes} legume year${x.legumes > 1 ? "s" : ""} (${names.filter((_, i) => cropById[x.sequence[i]].is_legume).join(", ")}), which fix nitrogen for the following crop.` : "Includes no legume, so nitrogen must come from fertiliser in every year.",
    new Set(x.sequence).size < x.sequence.length && x.sequence.some((id, i) => i > 0 && x.sequence[i - 1] === id) ? "Repeats a crop in consecutive years, which raises pest and disease pressure." : "No crop is grown in consecutive years, which breaks pest and disease cycles.",
  ];
  delete x.legumes; delete x.totalDef;
}
rotations.sort((a, b) => b.scores.total - a.scores.total);

const ILLUSTRATIVE =
  "Fixture only: rotation scores and yearly water figures were produced by a simplified script (mean-climate Kc-weighted demand using engine Penman-Monteith ET0 distributed over months by a Hargreaves shape, 80 % effective rainfall, half of root-zone AWC available, heuristic soil/income/risk scores), not by the Travertine engine. Replace with engine output.";

// ---------- write ----------
out("health.json", { status: "ok", version: "1.0.0" });
out("crops.json", crops);
out("field-analyze.json", {
  ...engineField,
  ndvi_history,
  provenance: [...engineField.provenance, PROV.modis],
});
out("rotations-explore.json", {
  rotations,
  provenance: [...engineField.provenance, PROV.fao56, { ...PROV.fao56, dataset: "Travertine fixture rotation scoring (illustrative)", provider: "Travertine project", spatial_resolution: "Field", temporal_coverage: "2001–2024 climatology", access_url: "https://github.com/musbabaff/travertine/blob/main/packages/contract/scripts/build-fixtures.mjs", note: ILLUSTRATIVE }],
});
out("validation.json", {
  years: vyears,
  correlation: r(corr, 2),
  n: vyears.length,
  method: "Pearson correlation between a growing-season (April–September) climatic water-deficit proxy, 1 − P/ET0 (NASA POWER precipitation; ET0 from the engine's annual FAO-56 Penman-Monteith, distributed over months by a Hargreaves shape), and the standardised anomaly of growing-season mean MODIS NDVI at the field centre pixel, one value per year.",
  caveats: [
    "Fixture only: the stress series is a simple climatic proxy, not the Travertine engine's crop water-balance model.",
    "NDVI comes from a single 250 m pixel without cloud or quality filtering; it may mix several fields and land uses.",
    "Irrigation is not represented: irrigated fields can stay green in dry years, which weakens the relationship.",
    `${vyears.length} years is a small sample; the correlation is uncertain and shows association, not causation.`,
  ],
  provenance: [engineField.provenance[0], PROV.modis],
});
console.log({ soil, corr: r(corr, 3), clay030, sand030, silt030, ndviYears: ndvi_history.length });
console.table(rotations.map((x) => ({ seq: x.sequence.join(">"), ...x.scores })));
