// Native WebView acceptance. Only a dedicated synthetic campaign is permitted.
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
assert.equal(process.env.CHRONEXUS_RELEASE_QA, "isolated");
const out = ".tools/m11-m13";
await mkdir(out, { recursive: true });
const browser = await chromium.connectOverCDP("http://127.0.0.1:9223");
const page = browser
  .contexts()[0]
  .pages()
  .find((p) => p.url().includes("1420"));
assert(page);
await page.bringToFront();
await page.setViewportSize({ width: 1586, height: 992 });
const errors = [],
  remote = [];
page.on("pageerror", (e) => errors.push(e.message));
const local = new Set([
  "127.0.0.1",
  "localhost",
  "ipc.localhost",
  "asset.localhost",
]);
await page
  .context()
  .route(/^https?:/, (r) =>
    local.has(new URL(r.request().url()).hostname) ? r.continue() : r.abort(),
  );
page.on("request", (r) => {
  if (/^https?:/.test(r.url()) && !local.has(new URL(r.url()).hostname))
    remote.push(r.url());
});
const call = (name, args = {}) =>
  page.evaluate(
    ({ name, args }) => window.__TAURI_INTERNALS__.invoke(name, args),
    { name, args },
  );
const plain = {
  version: 2,
  locale: "it",
  script: "standard",
  showOriginal: true,
};
const campaigns = await call("list_campaigns");
assert(campaigns.every((c) => c.name === "Collaudo M11-M13"));
const campaign =
  campaigns[0] ?? (await call("create_campaign", { name: "Collaudo M11-M13" }));
await call("save_interface_preferences", { preferences: plain });
await page.reload();
await page.getByRole("button", { name: "Tiradadi", exact: true }).click();
let saved = [];
let before = null;
do {
  const h = await call("list_dice_rolls", { campaignId: campaign.id, before });
  saved.push(...h.rolls);
  before = h.nextCursor;
} while (before);
const targets = [];
for (const sides of [4, 6, 8, 10, 12, 20, 100]) {
  const found = new Map();
  for (const r of saved.filter(
    (r) =>
      r.groups.length === 1 &&
      r.groups[0].sides === sides &&
      r.groups[0].quantity === 1,
  ))
    if ([1, sides].includes(r.total)) found.set(r.total, r);
  for (let i = 0; found.size < 2 && i < 2000; i++) {
    const r = await call("roll_dice", {
      campaignId: campaign.id,
      requestId: randomUUID(),
      selections: [{ sides, quantity: 1 }],
    });
    saved.push(r);
    if ([1, sides].includes(r.total)) found.set(r.total, r);
  }
  assert.equal(found.size, 2, `random extremes d${sides}`);
  for (const [value, roll] of found)
    targets.push({
      sides,
      value,
      roll,
      outcome: (sides === 100 ? value === 1 : value === sides)
        ? "celebration"
        : "threat",
    });
}
const mixed = await call("roll_dice", {
  campaignId: campaign.id,
  requestId: randomUUID(),
  selections: [
    { sides: 4, quantity: 2 },
    { sides: 100, quantity: 1 },
  ],
});
saved.push(mixed);
await page.reload();
await page.getByRole("button", { name: "Tiradadi", exact: true }).click();
await expect(page.locator(".dice-history-list li").first()).toBeVisible();
while (
  await page
    .getByRole("button", { name: "Carica tiri precedenti", exact: true })
    .count()
) {
  const count = await page.locator(".dice-history-list li").count();
  await page
    .getByRole("button", { name: "Carica tiri precedenti", exact: true })
    .click();
  await expect
    .poll(() => page.locator(".dice-history-list li").count())
    .toBeGreaterThan(count);
}
async function review(roll) {
  const li = page.locator(`.dice-history-list li[data-roll-id="${roll.id}"]`);
  await li.locator("summary").click();
  await li
    .getByRole("button", { name: "Mostra nel cerchio", exact: true })
    .click();
  await expect(page.locator(".dice-scene")).toHaveAttribute(
    "data-roll-id",
    roll.id,
  );
}
const result = [];
for (const t of targets) {
  await review(t.roll);
  await expect(page.locator(".dice-scene")).toHaveAttribute(
    "data-outcome",
    t.outcome,
  );
  await page
    .getByRole("button", {
      name: "Rivedi animazione del tiro salvato",
      exact: true,
    })
    .click();
  await expect(page.locator(".dice-scene")).toHaveAttribute(
    "data-outcome",
    "pending",
  );
  await expect(page.locator(".living-dragon")).toHaveCount(2, {
    timeout: 3000,
  });
  await expect(page.locator(".dice-scene")).toHaveAttribute(
    "data-outcome",
    t.outcome,
  );
  if (t.sides === 20) {
    await page.waitForTimeout(550);
    await page.screenshot({ path: `${out}/dragons-${t.outcome}.png` });
  }
  await page
    .getByRole("button", { name: "Salta animazione", exact: true })
    .click();
  await expect(page.locator(".living-dragon")).toHaveCount(0);
  result.push({
    sides: t.sides,
    value: t.value,
    outcome: t.outcome,
    id: t.roll.id,
  });
}
await review(mixed);
await expect(page.locator(".dice-scene")).toHaveAttribute(
  "data-outcome",
  "ordinary",
);
await page.emulateMedia({ reducedMotion: "reduce" });
await review(targets[0].roll);
await page
  .getByRole("button", {
    name: "Rivedi animazione del tiro salvato",
    exact: true,
  })
  .click();
await expect(page.locator(".living-dragon")).toHaveCount(0);
await expect(page.locator(".dice-scene")).toHaveAttribute(
  "data-phase",
  "finished",
);
await page.emulateMedia({ reducedMotion: "no-preference" });
const all = [];
before = null;
do {
  const h = await call("list_dice_rolls", { campaignId: campaign.id, before });
  all.push(...h.rolls);
  before = h.nextCursor;
} while (before);
assert.equal(all.length, saved.length);
for (const r of saved)
  assert.deepEqual(
    all.find((x) => x.id === r.id),
    r,
  );
const dataHash = createHash("sha256")
  .update(JSON.stringify([...all].sort((a, b) => a.id.localeCompare(b.id))))
  .digest("hex");
await page
  .getByRole("button", { name: "Impostazioni dell’app", exact: true })
  .click();
const alphabet =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789 !?";
for (const script of ["espruar", "dethek"]) {
  await page.locator(".language-settings select").nth(1).selectOption(script);
  await expect(page.locator(".language-settings select").nth(1)).toBeEnabled();
  assert.equal((await call("get_interface_preferences")).script, script);
  const input = page.locator(".transcription-preview textarea").first();
  // The laboratory is deliberately separate from campaign documents.
  const areas = page.locator(".transcription-lab textarea");
  const selector = (await input.count()) ? input : areas.first();
  await selector.fill(alphabet + " è 日本語");
  const loaded = await page.evaluate(
    async (family) => {
      const faces = await document.fonts.load(
        `24px "Chronexus ${family}"`,
        "AZaz",
      );
      return faces.length > 0 && faces.every((x) => x.status === "loaded");
    },
    script === "espruar" ? "Espruar" : "Dethek",
  );
  assert(loaded);
  await page
    .getByRole("button", { name: "Prepara pacchetto reversibile", exact: true })
    .click();
  const packet = await page
    .locator(".transcription-preview textarea")
    .nth(2)
    .inputValue();
  assert.equal(JSON.parse(packet).version, 2);
  assert.equal(JSON.parse(packet).original, alphabet + " è 日本語");
  await selector.fill("changed");
  await page
    .getByRole("button", {
      name: "Ripristina originale dal pacchetto",
      exact: true,
    })
    .click();
  await expect(selector).toHaveValue(alphabet + " è 日本語");
  await page.screenshot({ path: `${out}/font-${script}.png`, fullPage: true });
}
const axe = await new AxeBuilder({ page }).analyze();
assert.equal(
  axe.violations.length,
  0,
  JSON.stringify(axe.violations.map((v) => v.id)),
);
await page.reload();
await page
  .getByRole("button", { name: "Impostazioni dell’app", exact: true })
  .click();
await expect(page.locator(".language-settings select").nth(1)).toHaveValue(
  "dethek",
);
const client = await page.context().newCDPSession(page);
await client.send("Network.enable");
await client.send("Network.setCacheDisabled", { cacheDisabled: true });
await page.route(/(Espruar|Dethek).*\.otf/, (r) => r.abort());
await page.reload();
await page
  .getByRole("button", { name: "Impostazioni dell’app", exact: true })
  .click();
await page.locator(".transcription-preview textarea").first().fill("Oran");
await expect(
  page.locator(".transcription-sample .script-original"),
).toBeVisible();
await page.screenshot({ path: `${out}/font-fallback.png` });
assert.equal(remote.length, 0);
assert.equal(errors.length, 0, JSON.stringify(errors));
await writeFile(
  `${out}/native-report.json`,
  JSON.stringify(
    {
      campaignId: campaign.id,
      targets: result,
      rollCount: all.length,
      dataHash,
      fonts: ["espruar", "dethek"],
      axeViolations: 0,
      remote,
      errors,
    },
    null,
    2,
  ),
);
console.log(
  `PASS native: 14 extremes, replay unchanged, ${all.length} saved rolls, fonts/packet/fallback, axe 0`,
);
await browser.close();
