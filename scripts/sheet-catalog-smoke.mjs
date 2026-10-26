// Real desktop/SQLite/API checks. Network failure is simulated only in offline steps.
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
const phase = process.argv[2];
assert(["prepare", "verify", "restore", "verify-restored"].includes(phase));
await expect
  .poll(
    async () => {
      try {
        return (await fetch("http://127.0.0.1:9223/json/version")).ok;
      } catch {
        return false;
      }
    },
    { timeout: 20000 },
  )
  .toBe(true);
const browser = await chromium.connectOverCDP("http://127.0.0.1:9223");
let page;
await expect
  .poll(
    () => {
      page = browser
        .contexts()
        .flatMap((c) => c.pages())
        .find((p) => p.url().includes("127.0.0.1:1420"));
      return Boolean(page);
    },
    { timeout: 20000 },
  )
  .toBe(true);
await expect(
  page.getByRole("heading", { name: "Chronexus", exact: true }),
).toBeVisible();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const requests = [];
page.on("request", (r) => {
  if (r.url().startsWith("https://www.dnd5eapi.co/"))
    requests.push({ url: r.url(), method: r.method() });
});
const invoke = (name, args) =>
  page.evaluate(
    ({ name, args }) => window.__TAURI_INTERNALS__.invoke(name, args),
    { name, args },
  );
const click = (name) => page.getByRole("button", { name, exact: true }).click();
const fill = (label, value) =>
  page.getByLabel(label, { exact: true }).fill(String(value));
const section = (title) =>
  page
    .locator("details")
    .filter({ has: page.locator("summary").getByText(title, { exact: true }) });
async function expand(title) {
  const el = section(title);
  if (!(await el.getAttribute("open"))) {
    if (!(await el.evaluate((e) => e.open)))
      await el.locator("summary").click();
  }
}
async function snapshot() {
  const campaign = (await invoke("list_campaigns")).find(
    (c) => c.name === "Scheda e catalogo QA",
  );
  assert(campaign);
  const character = await invoke("get_character", { campaignId: campaign.id });
  assert(character);
  return {
    campaign,
    character,
    assets: await invoke("list_player_assets", {
      campaignId: campaign.id,
      characterId: character.id,
    }),
    sessions: await invoke("list_sessions", { campaignId: campaign.id }),
    index: await invoke("read_catalog_cache", { path: "spells" }),
    wizard: await invoke("read_catalog_cache", { path: "classes/wizard" }),
    longsword: await invoke("read_catalog_cache", {
      path: "equipment/longsword",
    }),
    rule: await invoke("read_catalog_cache", { path: "rules/passive-checks" }),
    spell: await invoke("read_catalog_cache", { path: "spells/magic-missile" }),
  };
}
async function close() {
  await invoke("plugin:window|close", { label: "main" }).catch((e) => {
    if (!String(e).includes("closed")) throw e;
  });
}
try {
  if (phase === "prepare") {
    assert.equal(
      (await invoke("list_campaigns")).length,
      0,
      "Use a fresh isolated debug profile",
    );
    const camp = await invoke("create_campaign", {
      name: "Scheda e catalogo QA",
    });
    await invoke("create_session", {
      campaignId: camp.id,
      sequence: 1,
      title: "The tower",
      playedOn: null,
    });
    await page.reload();
    await click("Scheda e catalogo QA");
    await click("Character");
    await click("Create character");
    await fill("Character name", "Neme");
    await fill("Maximum HP", 24);
    await fill("Current HP", 19);
    await expand("Identity and background");
    await fill("Background", "Tower cartographer");
    await fill("Alignment", "Neutrale");
    await expand("Combat and senses");
    await fill("Armor class", "15");
    await fill("Proficiency bonus", "+2");
    await fill("Death save successes", 2);
    await page.getByLabel("Inspiration", { exact: true }).check();
    await expand("History, appearance and proficiencies");
    await fill("Linguaggi", "Comune, Elfico");
    await fill("Ideals", "Protect the memories");
    await expand("Money, valuables and load");
    await fill("Gold pieces", "27");
    await expand("Magic");
    await fill("Spell save DC", "13");
    await fill("Spellcasting ability", "Intelligence");
    await expand("Armi, attacchi e munizioni (0)");
    await click("Add attack");
    await fill("Arma o attacco 1", "Arco corto");
    await fill("Bonus attacco 1", "+4");
    await fill("Danno e tipo 1", "1d6 perforante");
    await fill("Munizioni 1", "12");
    await click("Add D&D 2014 fields");
    await click("Add 1st–9th level slots");
    await fill("Risorsa 1: massimo", 3);
    await fill("Risorsa 1: attuale", 2);
    await click("Save character");
    await expect(
      page.getByRole("button", { name: "Edit character", exact: true }),
    ).toBeVisible();
    assert.equal(requests.length, 0, "No automatic network traffic");
    const before = await snapshot();
    assert.equal(before.character.data.stats.length, 30);
    assert.equal(before.character.data.resources.length, 9);
    await click("Abilities");
    await click("Search D&D");
    await fill("Catalog name", "Magic Missile");
    await click("Search the API");
    const catalog = page.getByRole("region", {
      name: "D&D catalog",
      exact: true,
    });
    await expect(
      catalog.getByRole("button", { name: /Magic Missile/ }),
    ).toBeVisible({ timeout: 15000 });
    await catalog.getByRole("button", { name: /Magic Missile/ }).click();
    await expect(
      catalog.getByRole("button", {
        name: "Use this data in the form",
        exact: true,
      }),
    ).toBeVisible({ timeout: 15000 });
    await page.screenshot({
      path: ".tools/sheet-catalog-preview.png",
      fullPage: true,
    });
    await click("Use this data in the form");
    await expect(page.getByLabel("Entry name", { exact: true })).toHaveValue(
      "Magic Missile",
    );
    await fill("Entry name", "Neme’s darts");
    await fill("Entry notes", "Personal variant; source kept.");
    await click("Save entry");
    await expect(
      page.getByRole("heading", { name: "Neme’s darts", exact: true }),
    ).toBeVisible();
    await click("Add spell");
    await fill("Entry name", "Signal of memories");
    await fill("Description", "Original test spell, stays local.");
    await click("Search this name in D&D");
    await click("Search the API");
    await expect(
      page.getByText(/No results\. Try the English name/),
    ).toBeVisible();
    await click("Close catalog");
    await expect(page.getByLabel("Entry name", { exact: true })).toHaveValue(
      "Signal of memories",
    );
    await click("Save entry");
    await click("Search D&D");
    for (const [category, query] of [
      ["classes", "Wizard"],
      ["equipment", "Longsword"],
      ["rules", "Ability Checks"],
    ]) {
      await page
        .getByLabel("D&D category", { exact: true })
        .selectOption(category);
      await fill("Catalog name", query);
      await click("Search the API");
      await page
        .getByRole("navigation", { name: "D&D results", exact: true })
        .getByRole("button", { name: query, exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: query, exact: true }),
      ).toBeVisible({ timeout: 15000 });
      assert.equal(
        await page
          .getByRole("button", {
            name: "Use this data in the form",
            exact: true,
          })
          .count(),
        0,
      );
    }
    await click("Passive Checks");
    await expect(
      page.getByRole("heading", { name: "Passive Checks", exact: true }),
    ).toBeVisible({ timeout: 15000 });
    await click("Close catalog");
    const actual = await snapshot();
    assert.equal(actual.assets.length, 2);
    const imported = actual.assets.find(
      (a) => a.input.details.name === "Neme’s darts",
    );
    assert.equal(
      imported.input.details.catalogSource.path,
      "spells/magic-missile",
    );
    assert.equal(imported.input.details.known, false);
    assert.deepEqual(
      actual.character.data.resources,
      before.character.data.resources,
      "Catalog import cannot consume slots",
    );
    assert(requests.length >= 2);
    assert(
      requests.every(
        (r) =>
          r.method === "GET" &&
          !r.url.includes("?") &&
          !r.url.includes("memorie"),
      ),
    );
    await writeFile(
      ".tools/sheet-catalog-expectation.json",
      JSON.stringify(actual, null, 2),
    );
    await click("Character");
    await expect(
      page.getByRole("button", { name: "Edit character", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: ".tools/sheet-expanded.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 760, height: 800 });
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    await page.screenshot({
      path: ".tools/sheet-expanded-narrow.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 1200, height: 800 });
    await click("Backup and restore");
    await click("Create backup");
    await expect(
      page.getByRole("region", { name: "Backup created", exact: true }),
    ).toBeVisible({ timeout: 20000 });
    await close();
    console.log(
      "PASS sheet UI, real API spell import/customization, homebrew lookup, privacy, backup and 760px",
    );
  } else {
    const expected = JSON.parse(
      await readFile(".tools/sheet-catalog-expectation.json", "utf8"),
    );
    if (phase === "restore") {
      assert.equal((await invoke("list_campaigns")).length, 0);
      await click("Backup and restore");
      await click("Select backup");
      await expect(page.getByRole("alertdialog")).toBeVisible();
      await click("Replace archive");
      await expect(
        page.getByRole("region", {
          name: "Restore completed",
          exact: true,
        }),
      ).toBeVisible({ timeout: 20000 });
    }
    assert.deepEqual(await snapshot(), expected);
    if (phase !== "restore") {
      await page
        .context()
        .route("https://www.dnd5eapi.co/**", (route) =>
          route.abort("internetdisconnected"),
        );
      await click("Scheda e catalogo QA");
      await click("Abilities");
      await click("Search D&D");
      await fill("Catalog name", "Magic Missile");
      await click("Search the API");
      await page.getByRole("button", { name: /Magic Missile/ }).click();
      await expect(
        page.getByRole("button", {
          name: "Use this data in the form",
          exact: true,
        }),
      ).toBeVisible();
      assert.equal(
        requests.length,
        0,
        "Cached reads must not require network after restart",
      );
      await click("Refresh online entry");
      await expect(page.getByText(/Update failed/)).toBeVisible({
        timeout: 15000,
      });
      await page.screenshot({
        path: `.tools/sheet-catalog-${phase}.png`,
        fullPage: true,
      });
    }
    await close();
    console.log(
      `PASS ${phase}: identical sheet, spells, source IDs and cache; offline consult/refresh fallback`,
    );
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
