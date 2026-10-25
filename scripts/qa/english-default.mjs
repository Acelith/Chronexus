// Run only after m20-readme-media in its isolated synthetic debug profile.
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
assert.equal(process.env.CHRONEXUS_README_QA, "isolated");
const browser = await chromium.connectOverCDP("http://127.0.0.1:9224");
const page = browser
  .contexts()[0]
  .pages()
  .find((p) => p.url().includes("1420"));
assert(page);
const call = (name, args = {}) =>
  page.evaluate(
    ([n, a]) => window.__TAURI_INTERNALS__.invoke(n, a),
    [name, args],
  );
const campaigns = await call("list_campaigns");
assert.equal(campaigns.length, 1);
assert.equal(campaigns[0].name, "Varek’s Tower");
const original = JSON.stringify(campaigns);
assert.equal((await call("get_interface_preferences")).locale, "en");
await page.getByRole("button", { name: "App settings", exact: true }).click();
await page.getByLabel("Interface language", { exact: true }).selectOption("it");
await expect(page.locator("html")).toHaveAttribute("lang", "it");
await page.reload();
await expect(
  page.getByRole("button", { name: "Nuova campagna", exact: true }),
).toBeVisible();
assert.equal((await call("get_interface_preferences")).locale, "it");
await page
  .getByRole("button", { name: "Impostazioni dell’app", exact: true })
  .click();
await page
  .getByRole("button", {
    name: "English · Reset language and script",
    exact: true,
  })
  .click();
await expect(page.locator("html")).toHaveAttribute("lang", "en");
await page.reload();
await expect(
  page.getByRole("button", { name: "New campaign", exact: true }),
).toBeVisible();
assert.equal((await call("get_interface_preferences")).locale, "en");
assert.equal(JSON.stringify(await call("list_campaigns")), original);
await page.getByRole("button", { name: "App settings", exact: true }).click();
await page.setViewportSize({ width: 760, height: 900 });
await expect(
  page.getByLabel("Interface language", { exact: true }),
).toBeVisible();
const a11y = await new AxeBuilder({ page })
  .include(".language-settings")
  .analyze();
assert.deepEqual(
  a11y.violations.map((v) => v.id),
  [],
);
await page.screenshot({ path: ".tools/i18n-en/settings-narrow.png" });
await writeFile(
  ".tools/i18n-en/native-report.json",
  JSON.stringify(
    {
      freshEnglishDefault: true,
      italianChoiceSurvivesReload: true,
      englishRecoverySurvivesReload: true,
      campaignsUnchanged: true,
      accessibilityViolations: 0,
    },
    null,
    2,
  ),
);
console.log(
  "PASS native English default, Italian persistence, English recovery, campaign identity unchanged, axe 0",
);
await browser.close();
