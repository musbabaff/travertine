import { expect, test, type Page } from "@playwright/test";
import en from "../src/i18n/en.json";
import tr from "../src/i18n/tr.json";
import { PROPER_NAMES } from "../src/i18n/allowlist";
import showcase from "../../../packages/contract/fixtures/showcase.json";
import { DEMO_QUERY, fakeEngine, type EngineMode } from "./engine";

/**
 * Every page, in each language, must show no text of the other language: visible text, aria-labels, titles,
 * placeholders, alt texts and the tab title. Kept as they are: proper names (allowlist), place names of the showcase
 * sites, and text explicitly marked with a different `lang`.
 *
 * With the fake engine (CI), sentences the engine writes are fixtures in English, so regions marked
 * `data-engine-text` are skipped. With I18N_LIVE=1 the spec runs against a real engine (set I18N_BASE_URL) and checks
 * those regions too.
 */
const LIVE = process.env.I18N_LIVE === "1";
if (process.env.I18N_BASE_URL) test.use({ baseURL: process.env.I18N_BASE_URL });

const PLACES = showcase.fields.flatMap((f) => f.name.split(/,\s*/)).concat(["Sarayköy", "Denizli", "Büyük Menderes", "Türkiye"]);
const KEEP = [...PROPER_NAMES, ...PLACES].sort((a, b) => b.length - a.length);

// Word boundaries that know Turkish letters: JavaScript's \b treats ğ, ı and ş as non-word characters.
const EN_WORDS = /(?<![\p{L}\p{N}])(the|and|of|to|with|for|from|this|that|is|are|was|were|your|you|by|on|than|which|when|yet|daily|static|spatial|field|fields|years?|loading|failed|retry|rotations?|crops?|water|soil|wheat|barley|lentil|cotton|sunflower|maize|sorghum|tomato|soybean|alfalfa|beet|bean|explore|evidence|overview|sources?|resolution|coverage|provider|close|open|back|print|compare|average|median)(?![\p{L}\p{N}])/iu;
const TR_WORDS = /[ğşıİĞŞ]|(?<![\p{L}\p{N}])(ve|bir|için|ile|bu|olarak|veya|değil|yıl|tarla|nöbet|toprak|yağış)(?![\p{L}\p{N}])/iu;

function strip(text: string) {
  let out = text;
  for (const name of KEEP) out = out.split(name).join(" ");
  return out;
}

async function collect(page: Page, lang: "en" | "tr") {
  return page.evaluate(
    ({ lang, live }) => {
      const out: string[] = [];
      const skip = (el: Element | null): boolean => {
        for (let e = el; e; e = e.parentElement) {
          if (e.hasAttribute("data-proper-name")) return true;
          if (!live && e.hasAttribute("data-engine-text")) return true;
          const l = e.getAttribute("lang");
          if (l && e !== document.documentElement && l !== lang) return true;
          if (e.tagName === "SCRIPT" || e.tagName === "STYLE" || e.tagName === "NOSCRIPT") return true;
          if (e.classList.contains("maplibregl-ctrl-attrib") || e.closest(".maplibregl-ctrl-attrib")) return true;
        }
        return false;
      };
      const visible = (el: Element) => {
        const s = getComputedStyle(el);
        if (s.display === "none" || s.visibility === "hidden") return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const el = n.parentElement;
        const text = n.textContent?.trim();
        if (!text || !el || skip(el) || !(visible(el) || el.closest(".sr-only"))) continue;
        out.push(text);
      }
      for (const el of document.querySelectorAll("[aria-label],[title],[placeholder],[alt]")) {
        if (skip(el)) continue;
        for (const a of ["aria-label", "title", "placeholder", "alt"]) {
          const v = el.getAttribute(a);
          if (v) out.push(v);
        }
      }
      out.push(document.title);
      return out;
    },
    { lang, live: LIVE },
  );
}

async function expectOnlyLanguage(page: Page, lang: "en" | "tr", where: string) {
  await page.waitForTimeout(1500);
  const foreign = lang === "tr" ? EN_WORDS : TR_WORDS;
  const hits = [...new Set((await collect(page, lang)).filter((t) => foreign.test(strip(t))))];
  expect(hits, `${where}: text of the other language`).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.lang)).toBe(lang);
}

const PLAN = "plan=winter_wheat,lentil,sunflower,barley";

for (const lang of ["en", "tr"] as const) {
  const dict = (lang === "en" ? en : tr) as Record<string, string>;

  test.describe(`language coverage (${lang})`, () => {
    test.describe.configure({ timeout: 180_000 });

    async function open(page: Page, path: string, mode: EngineMode = "ok", introSeen = true) {
      await page.addInitScript(
        ({ l, seen }) => {
          localStorage.setItem("travertine.locale", l);
          if (seen) localStorage.setItem("travertine-cosmo-intro-v4", "seen");
          else localStorage.removeItem("travertine-cosmo-intro-v4");
        },
        { l: lang, seen: introSeen },
      );
      if (!LIVE) await fakeEngine(page, mode);
      await page.goto(path);
      await page.waitForLoadState("networkidle").catch(() => {});
    }

    for (const [name, path] of [
      ["landing", "/"],
      ["field without a field", "/app"],
      ["overview", "/app/overview"],
      ["field", `/app?${DEMO_QUERY}`],
      ["evidence", `/app/evidence?${DEMO_QUERY}`],
      ["data", `/app/data?${DEMO_QUERY}`],
      ["explore without a field", "/app/explore"],
      ["404", "/no-such-page"],
    ] as const) {
      test(name, async ({ page }) => {
        await open(page, path);
        await expectOnlyLanguage(page, lang, name);
      });
    }

    test("explore with reasoning and the compare dialog", async ({ page }) => {
      await open(page, `/app/explore?${DEMO_QUERY}`);
      await expect(page.getByRole("button", { name: dict["explore.compare.select"], exact: true }).first()).toBeVisible();
      const reasoning = page.getByText(dict["reasoning.title"]);
      if (await reasoning.count()) await reasoning.first().click();
      await expectOnlyLanguage(page, lang, "explore");
      const picks = page.getByRole("button", { name: dict["explore.compare.select"], exact: true });
      await picks.nth(0).click();
      await picks.nth(1).click();
      await page.getByRole("button", { name: dict["explore.compare.open"] }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await expectOnlyLanguage(page, lang, "compare dialog");
    });

    test("plan and its print view", async ({ page }) => {
      await open(page, `/app/plan?${DEMO_QUERY}&${PLAN}`);
      await expectOnlyLanguage(page, lang, "plan");
      await page.emulateMedia({ media: "print" });
      await expectOnlyLanguage(page, lang, "plan print");
    });

    test("Cosmo panel and the tour", async ({ page }) => {
      await open(page, "/app/overview", "ok", false);
      await page.keyboard.press("Shift");
      const tour = page.getByRole("dialog", { name: dict["cosmo.tour.label"] });
      await expect(tour).toBeVisible();
      await expectOnlyLanguage(page, lang, "tour");
      await tour.getByRole("button", { name: dict["cosmo.tour.0.action"] }).click();
      await expectOnlyLanguage(page, lang, "tour step 2");
      await page.keyboard.press("Escape");
      await page.goto(`/app/explore?${DEMO_QUERY}`);
      await page.keyboard.press("Shift");
      await page.getByRole("button", { name: dict["cosmo.ui.ask"] }).first().click();
      await expect(page.getByRole("dialog", { name: dict["cosmo.ui.chat"] })).toBeVisible();
      await expectOnlyLanguage(page, lang, "Cosmo panel");
    });

    test("error states", async ({ page }) => {
      test.skip(LIVE, "needs the fake engine");
      await open(page, `/app?${DEMO_QUERY}`, "error");
      await expectOnlyLanguage(page, lang, "field error");
      await page.goto(`/app/explore?${DEMO_QUERY}`);
      await expectOnlyLanguage(page, lang, "explore error");
    });
  });
}
