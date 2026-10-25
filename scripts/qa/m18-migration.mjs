// Restore ONLY the synthetic M18 legacy017 fixture in a fresh debug profile.
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
assert.equal(process.env.CHRONEXUS_AI_QA, "isolated");
const policy = JSON.parse(
  await readFile(new URL("../../src/ai-models.json", import.meta.url), "utf8"),
);
const legacy = JSON.parse(
  await readFile(".tools/m18/legacy-state.json", "utf8"),
);
assert.equal(legacy.campaign.name, "M18 legacy Qwen migration fixture");
const browser = await chromium.connectOverCDP("http://127.0.0.1:9228");
const page = browser.contexts()[0].pages()[0];
await page.waitForLoadState("networkidle");
const call = (name, args = {}) =>
  page.evaluate(
    ([n, a]) => window.__TAURI_INTERNALS__.invoke(n, a),
    [name, args],
  );
assert.equal(
  (await call("list_campaigns")).length,
  0,
  "Use a fresh isolated profile",
);
const preview = await call("inspect_backup");
assert.equal(preview.manifest.schema_version, 17);
await call("restore_backup", { token: preview.token });
const campaigns = await call("list_campaigns");
assert.equal(campaigns.length, 3);
const old = await call("get_ai_settings", { campaignId: legacy.campaign.id });
assert.equal(old.enabled, false);
assert.equal(old.model, "qwen3:4b-instruct");
assert.equal((await call("get_ai_settings")).enabled, false);
const history = await call("list_ai_history", {
  campaignId: legacy.campaign.id,
  offset: 0,
});
assert.equal(history[0].id, legacy.turn.id);
assert.equal(history[0].model, legacy.turn.model);
assert.equal(history[0].answer, legacy.turn.answer);
const citation = await call("check_ai_source", {
  campaignId: legacy.campaign.id,
  turnId: legacy.turn.id,
  key: legacy.turn.sources[0].key,
});
assert.equal(citation.available, true);
assert.equal(citation.changed, false);
await assert.rejects(
  call("configure_local_ai", {
    enabled: true,
    model: old.model,
    multilingualConsent: true,
    campaignId: legacy.campaign.id,
  }),
  /non qualificato|ritirato/,
);
const other = campaigns.find((c) => c.name.startsWith("Prova AI M7"));
assert(other);
const gemma = await call("get_ai_settings", { campaignId: other.id });
assert.equal(gemma.enabled, true);
assert.equal(gemma.model, policy.secondary.name);
await page.reload();
await page
  .getByLabel("Current campaign", { exact: true })
  .selectOption(legacy.campaign.id);
await page
  .getByRole("button", { name: "Campaign settings", exact: true })
  .click();
await expect(
  page.getByText(/Il precedente modello Qwen è stato ritirato/),
).toBeVisible();
await page
  .getByRole("button", { name: "Check Ollama and GPU", exact: true })
  .click();
const picker = page.getByLabel("Local model", { exact: true });
await expect(picker).toHaveValue(policy.primary.name);
const choices = await picker.locator("option").allTextContents();
assert.match(choices[1], /Qwen3.8-27B.*Principale/);
assert.match(choices[2], /Gemma 4 12B.*Secondario/);
assert(choices.every((t) => !t.includes("qwen3:4b")));
const activate = page.getByRole("button", {
  name: "Activate model for the campaign",
  exact: true,
});
await expect(activate).toBeDisabled();
await page
  .getByRole("checkbox", { name: /Confermo l'uso di un modello multilingue/ })
  .check();
await activate.click();
await expect
  .poll(
    async () =>
      (await call("get_ai_settings", { campaignId: legacy.campaign.id })).model,
  )
  .toBe(policy.primary.name);
assert.equal(
  (await call("get_training_overview", { campaignId: legacy.campaign.id }))
    .trainingSupported,
  false,
);
await expect(
  page.getByRole("button", { name: "Retrain on the new data", exact: true }),
).toBeDisabled();
const a11y = await new AxeBuilder({ page })
  .include(".campaign-settings")
  .analyze();
assert.deepEqual(
  a11y.violations.map((v) => v.id),
  [],
);
await page.screenshot({
  path: ".tools/m18/settings-primary.png",
  fullPage: true,
});
await picker.selectOption(policy.secondary.name);
await activate.click();
await expect
  .poll(
    async () =>
      (await call("get_ai_settings", { campaignId: legacy.campaign.id })).model,
  )
  .toBe(policy.secondary.name);
assert.equal(
  (await call("get_training_overview", { campaignId: legacy.campaign.id }))
    .trainingSupported,
  true,
);
await page.setViewportSize({ width: 760, height: 900 });
await page.screenshot({
  path: ".tools/m18/settings-secondary-narrow.png",
  fullPage: true,
});
await writeFile(
  ".tools/m18/migration-native-report.json",
  JSON.stringify(
    {
      oldBackupRestored: true,
      retiredDisabled: true,
      historicalTurnPreserved: true,
      citationStillCurrent: true,
      gemmaPreserved: true,
      primaryFirst: true,
      secondaryExplicit: true,
      trainingEligibilityCorrect: true,
      accessibilityViolations: 0,
    },
    null,
    2,
  ),
);
console.log(
  "PASS native017 restore/migration, immutable history/citation, primary/secondary explicit, QLoRA eligibility, axe0",
);
await browser.close();
