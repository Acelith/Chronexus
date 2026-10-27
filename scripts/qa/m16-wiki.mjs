// M16 desktop acceptance on an isolated debug profile only. It makes a few
// explicit public requests to dnd5e.wikidot.com (index + one page, spaced by the
// app) and at most one consented Open5e search. No personal campaign is accepted.
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
assert.equal(
  process.env.CHRONEXUS_WIKI_QA,
  "isolated",
  "Launch with an empty NODEX_DEV_DATA_DIR and set CHRONEXUS_WIKI_QA=isolated.",
);
const phase = process.argv[2] ?? "check";
assert(["check", "restart"].includes(phase));
const NAME = "Collaudo wiki M16";
await expect
  .poll(
    async () => {
      try {
        return (await fetch("http://127.0.0.1:9223/json/version")).ok;
      } catch {
        return false;
      }
    },
    { timeout: 30000 },
  )
  .toBe(true);
const browser = await chromium.connectOverCDP("http://127.0.0.1:9223");
const page = browser
  .contexts()[0]
  .pages()
  .find((p) => p.url().includes("1420"));
assert(page, "Chronexus debug window not found");
const remote = [];
page.on("request", (r) => {
  const host = new URL(r.url()).hostname;
  if (
    !["127.0.0.1", "localhost", "tauri.localhost", "ipc.localhost"].includes(
      host,
    )
  )
    remote.push(r.url());
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const call = (name, args) =>
  page.evaluate(
    ([n, a]) => window.__TAURI_INTERNALS__.invoke(n, a),
    [name, args ?? {}],
  );
const campaigns = await call("list_campaigns");
if (campaigns.length && (campaigns.length !== 1 || campaigns[0].name !== NAME))
  throw Error("Profile is not the isolated M16 fixture; nothing written.");
const report = { phase, steps: [] };
const step = (name, data = {}) => {
  report.steps.push({ name, ...data });
  console.log(
    `PASS ${name}`,
    Object.keys(data).length ? JSON.stringify(data) : "",
  );
};
await page.getByRole("button", { name: "App settings" }).click();
const settings = page.getByRole("region", { name: "D&D sources / Wiki" });

if (phase === "check") {
  assert.equal(campaigns.length, 0, "check needs an empty profile");
  assert.deepEqual(await call("get_wiki_provider"), {
    provider: "wikidot",
    explicit: false,
  });
  await expect(
    settings.getByRole("radio", { name: /Wikidot D&D 5e/ }),
  ).toBeChecked();
  await expect(settings.getByText(/No choice saved/)).toBeVisible();
  assert.equal(remote.length, 0, "settings must not contact remote hosts");
  step("default Wikidot without campaign, no network on open");

  await call("create_campaign", { name: NAME });
  await page.reload();
  await page.getByRole("button", { name: "Character", exact: true }).click();
  await page.getByRole("button", { name: "Create character" }).click();
  await page.getByLabel("Character name").fill("Test Oran");
  await page.getByRole("button", { name: "Save character" }).click();
  await expect(page.getByRole("heading", { name: "Test Oran" })).toBeVisible();

  await page.getByRole("button", { name: "D&D Wiki", exact: true }).click();
  await expect(page.getByText(/Fonte attiva: Wikidot D&D 5e/)).toBeVisible();
  await page.getByLabel("Name in the wiki").fill("acid splash");
  const started = Date.now();
  await page.getByRole("button", { name: "Search Wikidot" }).click();
  const hit = page.getByRole("button", { name: /^Acid Splash/ });
  await expect(hit).toBeVisible({ timeout: 30000 });
  await hit.click();
  const article = page.getByRole("article", { name: "Wiki entry" });
  await expect(
    article.getByText(/Fonte dichiarata: Player's Handbook/),
  ).toBeVisible({ timeout: 30000 });
  await expect(
    article.getByText("https://dnd5e.wikidot.com/spell:acid-splash"),
  ).toBeVisible();
  assert(Date.now() - started >= 1400, "second Wikidot request must be spaced");
  assert.equal(await article.locator("script, iframe, img, form").count(), 0);
  assert.equal(
    remote.length,
    0,
    "Wikidot is fetched by Rust, never by the WebView",
  );
  step("real Wikidot index + page, spaced, inert", {
    ms: Date.now() - started,
  });

  await article
    .getByRole("button", { name: "Prepare import into the sheet" })
    .click();
  const name = page.getByLabel("Entry name");
  await expect(name).toHaveValue("Acid Splash");
  await expect(page.getByText(/Base Wikidot D&D 5e/)).toBeVisible();
  const before = await call("get_character", {
    campaignId: (await call("list_campaigns"))[0].id,
  });
  assert.equal(
    (
      await call("list_player_assets", {
        campaignId: before.campaignId,
        characterId: before.id,
      })
    ).length,
    0,
    "preview must not save",
  );
  await page.getByRole("button", { name: "Save entry" }).click();
  await expect(page.getByText("Saved on the computer.")).toBeVisible();
  const assets = await call("list_player_assets", {
    campaignId: before.campaignId,
    characterId: before.id,
  });
  assert.equal(assets.length, 1);
  assert.deepEqual(assets[0].input.details.catalogSource, {
    path: "spell:acid-splash",
    name: "Acid Splash",
    provider: "wikidot",
  });
  assert.equal(assets[0].input.details.rank, "0");
  assert.equal(assets[0].input.details.components, "V, S");
  step("explicit import with provenance", {
    details: assets[0].input.details.castingTime,
  });

  await page.getByRole("button", { name: "D&D Wiki", exact: true }).click();
  await page.getByLabel("Name in the wiki").fill("zzqq no entry");
  await page.getByRole("button", { name: "Search Wikidot" }).click();
  const prompt = page.getByRole("alertdialog");
  await expect(prompt).toContainText(
    "Wikidot did not provide the information. Do you want to use Open5e?",
  );
  await prompt.getByRole("button", { name: "Stay on Wikidot" }).click();
  await expect(prompt).toHaveCount(0);
  assert.equal(remote.filter((u) => u.includes("open5e")).length, 0);
  assert.equal((await call("get_wiki_provider")).explicit, false);
  step("refusal keeps Wikidot and sends nothing to Open5e");

  await page.getByRole("button", { name: "Search Wikidot" }).click();
  await prompt
    .getByRole("button", { name: "Use Open5e and save the choice" })
    .click();
  await expect(page.getByText(/Fonte attiva: Open5e/)).toBeVisible();
  await expect
    .poll(() => remote.filter((u) => u.includes("api.open5e.com")).length, {
      timeout: 20000,
    })
    .toBe(1);
  assert(
    remote.find((u) => u.includes("api.open5e.com")).includes("query=zzqq"),
  );
  assert.deepEqual(await call("get_wiki_provider"), {
    provider: "open5e",
    explicit: true,
  });
  await page.waitForTimeout(1500);
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  step("acceptance persists Open5e and repeats one search");

  await page.getByRole("button", { name: "App settings" }).click();
  // The radio reflects the saved preference, so it turns checked after the write.
  const wikidotRadio = settings.getByRole("radio", { name: /Wikidot D&D 5e/ });
  await wikidotRadio.click();
  await expect(
    settings.getByText("Wiki source saved: Wikidot D&D 5e."),
  ).toBeVisible();
  await expect(wikidotRadio).toBeChecked();
  const summary = await call("wiki_cache_summary");
  assert(summary.wikidot.entries >= 2, JSON.stringify(summary));
  await settings.getByRole("button", { name: "Clear offline cache…" }).click();
  await settings.getByRole("button", { name: "Cancel" }).click();
  assert.equal(
    (await call("wiki_cache_summary")).wikidot.entries,
    summary.wikidot.entries,
  );
  await settings.getByRole("button", { name: "Clear offline cache…" }).click();
  await settings
    .getByRole("button", { name: "Clear cache", exact: true })
    .click();
  await expect(
    settings.getByText("Cache svuotata: Wikidot D&D 5e."),
  ).toBeVisible();
  const after = await call("wiki_cache_summary");
  assert.equal(after.wikidot.entries, 0);
  assert.equal(
    after.open5e.entries,
    summary.open5e.entries,
    "other provider untouched",
  );
  assert.equal(
    (
      await call("list_player_assets", {
        campaignId: before.campaignId,
        characterId: before.id,
      })
    ).length,
    1,
    "imported spell survives a cache clear",
  );
  assert.equal((await call("get_wiki_provider")).provider, "wikidot");
  step("cache clear: scoped, confirmed, imports and choice preserved", {
    before: summary,
    after,
  });
} else {
  assert.equal(campaigns.length, 1, "restart needs the check fixture");
  assert.deepEqual(await call("get_wiki_provider"), {
    provider: "wikidot",
    explicit: true,
  });
  await expect(
    settings.getByRole("radio", { name: /Wikidot D&D 5e/ }),
  ).toBeChecked();
  const pc = await call("get_character", { campaignId: campaigns[0].id });
  const assets = await call("list_player_assets", {
    campaignId: pc.campaignId,
    characterId: pc.id,
  });
  assert.equal(assets[0].input.details.catalogSource.provider, "wikidot");
  assert.equal((await call("wiki_cache_summary")).wikidot.entries, 0);
  await page.getByRole("button", { name: "Spells", exact: true }).click();
  await expect(
    page.getByText("https://dnd5e.wikidot.com/spell:acid-splash"),
  ).toBeVisible();
  assert.equal(
    remote.length,
    0,
    "restart performs no automatic network request",
  );
  step("restart keeps choice, import and empty cache without refetch");
}
assert.deepEqual(errors, []);
await mkdir(".tools/m16", { recursive: true });
await writeFile(
  `.tools/m16/report-${phase}.json`,
  JSON.stringify(report, null, 2),
);
await page.screenshot({ path: `.tools/m16/${phase}.png` });
await browser.close();
