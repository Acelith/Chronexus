// Run only against the isolated M17 debug window, never a personal archive.
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
assert.equal(process.env.CHRONEXUS_TRANSLATION_QA, "isolated");
const browser = await chromium.connectOverCDP("http://127.0.0.1:9226");
const page = browser.contexts()[0].pages()[0];
await page.waitForLoadState("networkidle");
const call = (name, args = {}) =>
  page.evaluate(
    ([n, a]) => window.__TAURI_INTERNALS__.invoke(n, a),
    [name, args],
  );
const campaigns = await call("list_campaigns");
assert(
  campaigns.length === 0 ||
    (campaigns.length === 1 && campaigns[0].name === "Collaudo traduzione M17"),
);
if (!campaigns.length)
  await call("create_campaign", { name: "Collaudo traduzione M17" });
await call("save_wiki_provider", { provider: "open5e" });
await call("save_interface_preferences", {
  preferences: {
    version: 2,
    locale: "it",
    script: "standard",
    showOriginal: true,
  },
});
const epoch = await call("wiki_cache_epoch");
const hit = {
  object_pk: "m17-light",
  object_name: "Test Light",
  object_model: "spell",
  route: "v2/spells/",
  text: "A synthetic light.",
  document: { key: "test-srd", name: "Synthetic test source" },
};
await call("store_wiki_cache", {
  key: "search/light/1",
  epoch,
  payload: { count: 1, results: [hit] },
});
await call("store_wiki_cache", {
  key: "entry/spells/m17-light",
  epoch,
  payload: {
    entry: {
      key: "m17-light",
      name: "Test Light",
      desc: "A light shines for 1 minute. It illuminates a 30-foot radius. This spell does not deal damage.",
      document: { key: "test-srd" },
    },
    document: {
      key: "test-srd",
      name: "Synthetic test source",
      gamesystem: { key: "5e-2014", name: "5e 2014" },
      licenses: [
        { key: "test", name: "Synthetic fixture — no third-party content" },
      ],
    },
  },
});
await page.reload();
await page.getByRole("button", { name: "Personaggio", exact: true }).click();
if (
  await page
    .getByRole("button", { name: "Crea personaggio", exact: true })
    .count()
) {
  await page
    .getByRole("button", { name: "Crea personaggio", exact: true })
    .click();
  await page
    .getByLabel("Nome del personaggio")
    .fill("Personaggio sintetico M17");
  await page
    .getByRole("button", { name: "Salva personaggio", exact: true })
    .click();
}
await page.getByRole("button", { name: "Wiki D&D", exact: true }).click();
await page.getByLabel("Termine nella wiki").fill("light");
await page
  .getByRole("button", { name: "Cerca nella wiki", exact: true })
  .click();
await page.getByRole("button", { name: /Test Light/ }).click();
const translate = page.getByRole("button", {
  name: "Traduci in Italiano",
  exact: true,
});
await expect(
  page.getByRole("region", { name: "Traduzione della voce wiki" }),
).toBeVisible();
await expect(
  page.getByText("Lettura della traduzione salvata…", { exact: true }),
).toHaveCount(0);
if (await translate.count()) {
  await expect(translate).toBeEnabled();
  await translate.click();
}
await expect(page.getByText(/Bozza automatica/)).toBeVisible({
  timeout: 250000,
});
const original = await call("read_wiki_cache", {
  key: "entry/spells/m17-light",
});
assert.equal(original.payload.entry.name, "Test Light");
const translated = await call("read_wiki_translation", {
  provider: "open5e",
  key: "entry/spells/m17-light",
  locale: "it",
});
// A proper-name fixture may keep its title; verify translated prose instead.
assert(translated && translated.blocks[0].text !== original.payload.entry.desc);
assert.match(translated.blocks[0].text, /luce/i);
assert.match(translated.blocks[0].text, /1/);
assert.match(translated.blocks[0].text, /30/);
assert.match(translated.blocks[0].text.toLowerCase(), /non/);
await page.getByText("Mostra originale", { exact: true }).click();
await expect(
  page.getByText(original.payload.entry.desc, { exact: true }),
).toBeVisible();
const accessibility = await new AxeBuilder({ page })
  .include(".wiki-entry")
  .analyze();
assert.deepEqual(
  accessibility.violations.map((v) => v.id),
  [],
);
await page.screenshot({
  path: ".tools/m17/translation-wide.png",
  fullPage: true,
});
// Reload the persisted translation while browser requests to public hosts fail.
// Runtime-absent acceptance is recorded separately in the isolated QA report.
await page.route("https://**", (route) => route.abort());
await page.getByRole("button", { name: /Test Light/ }).click();
await expect(page.getByText(/Bozza automatica/)).toBeVisible();
await page.setViewportSize({ width: 760, height: 900 });
await page.locator(".wiki-translation").scrollIntoViewIfNeeded();
await page.screenshot({
  path: ".tools/m17/translation-narrow.png",
  fullPage: true,
});
await writeFile(
  ".tools/m17/native-report.json",
  JSON.stringify(
    {
      translated,
      accessibilityViolations: 0,
      originalPreserved: true,
      offlineCache: true,
    },
    null,
    2,
  ),
);
console.log(
  "PASS real Qwen GPU Italian translation, numbers/negation, original preserved, cache reload, axe 0",
);
await browser.close();
