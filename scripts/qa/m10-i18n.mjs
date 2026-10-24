// M10 desktop acceptance. Refuses archives that contain anything except this isolated fixture.
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
assert.equal(process.env.CHRONEXUS_I18N_QA, "isolated");
const phase = process.argv[2] ?? "check";
assert(["check", "restart", "recovery"].includes(phase));
const out = ".tools/m10";
await mkdir(out, { recursive: true });
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
const b = await chromium.connectOverCDP("http://127.0.0.1:9223");
await expect
  .poll(() =>
    b
      .contexts()[0]
      .pages()
      .some((p) => p.url().includes("1420")),
  )
  .toBe(true);
const page = b
  .contexts()[0]
  .pages()
  .find((p) => p.url().includes("1420"));
assert(page);
const errors = [],
  remote = [];
page.on("pageerror", (e) => {
  errors.push(e.message);
  console.error("PAGE ERROR", e.message);
});
const local = new Set([
  "127.0.0.1",
  "localhost",
  "ipc.localhost",
  "asset.localhost",
]);
page.on("request", (r) => {
  if (/^https?:/.test(r.url()) && !local.has(new URL(r.url()).hostname))
    remote.push(r.url());
});
await page
  .context()
  .route(/^https?:/, (r) =>
    local.has(new URL(r.request().url()).hostname) ? r.continue() : r.abort(),
  );
await page.setViewportSize({ width: 1586, height: 992 });
const call = (name, args = {}) =>
  page.evaluate(
    ({ name, args }) => window.__TAURI_INTERNALS__.invoke(name, args),
    { name, args },
  );
const plain = {
  version: 1,
  locale: "it",
  script: "standard",
  showOriginal: true,
};
const catalogs = {};
for (const locale of [
  "it",
  "en",
  "de",
  "fr",
  "es",
  "pt-BR",
  "ja",
  "ko",
  "zh-Hans",
  "ar",
  "lmo-CH",
  "tlh",
  "art-x-rihan",
])
  catalogs[locale] = JSON.parse(
    await readFile(`src/i18n/catalogs/${locale}.json`, "utf8"),
  );
const key = (s) =>
  "m_" + createHash("sha256").update(s.trim()).digest("hex").slice(0, 12);
const ui = async (source) => {
  const locale = await page.locator("html").getAttribute("lang");
  return catalogs[locale]?.[key(source)] ?? source;
};
const click = async (source) =>
  page.getByRole("button", { name: await ui(source), exact: true }).click();
const openPreferences = async () => {
  await click("Impostazioni dell’app");
  await page.locator(".language-settings").waitFor();
};
const selectLocale = async (locale) => {
  await openPreferences();
  await page.locator(".language-settings select").nth(0).selectOption(locale);
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
  await expect(page.locator(".language-settings select").nth(0)).toBeEnabled();
  assert.equal((await call("get_interface_preferences")).locale, locale);
};
let campaigns = await call("list_campaigns");
assert(
  campaigns.every((c) => c.name.startsWith("Collaudo M10")),
  "Refusing a non-fixture archive.",
);
let campaign = campaigns[0];
if (!campaign) {
  assert.equal(phase, "check");
  campaign = await call("create_campaign", {
    name: "Collaudo M10 — Oran 日本語 العربية",
  });
  const s = await call("create_session", {
    campaignId: campaign.id,
    sequence: 1,
    title: "Il sigillo — 日本語 العربية",
    playedOn: "2026-10-24",
  });
  await call("save_document", {
    campaignId: campaign.id,
    id: s.id,
    revision: s.revision,
    document: {
      version: 1,
      blocks: [
        {
          id: randomUUID(),
          type: "paragraph",
          props: {
            textAlignment: "left",
            textColor: "default",
            backgroundColor: "default",
          },
          content: [
            {
              type: "text",
              text: "Oran conserva il sigillo. 日本語 العربية. Fonte originale.",
              styles: {},
            },
          ],
          children: [],
        },
      ],
    },
  });
  const p = await call("create_page", {
    campaignId: campaign.id,
    title: "Varek — Il porto",
    kind: "npc",
    status: "active",
    aliases: ["Esploratore"],
  });
  await call("save_party_member", {
    campaignId: campaign.id,
    input: {
      pageId: p.id,
      name: p.title,
      playerName: "Giocatore di prova",
      role: "Alleato — ruolo originale",
      status: "active",
      revision: null,
    },
  });
  const input = {
    name: "Oran",
    systemId: "dnd5e-2014",
    vocation: "Bardo",
    ancestry: "Dhampir",
    level: 7,
    experience: null,
    hpCurrent: 54,
    hpMaximum: 54,
    hpTemporary: 0,
    stats: [
      {
        id: randomUUID(),
        label: "Forza",
        value: "10",
        modifier: "0",
        training: "none",
        group: "ability",
      },
    ],
    resources: [
      {
        id: randomUUID(),
        label: "Ispirazione bardica",
        kind: "resource",
        current: 3,
        maximum: 3,
      },
    ],
    conditions: "",
    notes: "Note originali — 日本語 العربية",
    sheet: {
      fields: {},
      inspiration: false,
      deathSuccesses: 0,
      deathFailures: 0,
      attacks: [],
    },
  };
  await call("save_character", {
    campaignId: campaign.id,
    id: null,
    revision: null,
    input,
  });
  await call("roll_dice", {
    campaignId: campaign.id,
    requestId: randomUUID(),
    selections: [
      { sides: 100, quantity: 1 },
      { sides: 20, quantity: 2 },
    ],
  });
}
async function snapshot() {
  const campaignId = campaign.id;
  return {
    campaigns: await call("list_campaigns"),
    sessions: await call("list_sessions", { campaignId }),
    pages: await call("list_pages", { campaignId }),
    party: await call("list_party", { campaignId }),
    character: await call("get_character", { campaignId }),
    rolls: await call("list_dice_rolls", { campaignId, before: null }),
  };
}
if (phase === "recovery") {
  const expected = JSON.parse(await readFile(`${out}/expected.json`, "utf8"));
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "it");
  await expect(page.getByRole("alert").first()).toBeVisible();
  await openPreferences();
  await page
    .getByRole("button", {
      name: "Italiano · Ripristina lingua e scrittura",
      exact: true,
    })
    .click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  assert.deepEqual(await call("get_interface_preferences"), plain);
  assert.deepEqual(await snapshot(), expected.data);
  await page.screenshot({ path: `${out}/preferences-recovered.png` });
  assert.deepEqual(errors, []);
  assert.deepEqual(remote, []);
  await writeFile(
    `${out}/recovery-result.json`,
    JSON.stringify(
      { corruptPreferencesRecovery: true, dataUnchanged: true, errors, remote },
      null,
      2,
    ),
  );
  console.log(
    "PASS: preferenze corrotte recuperate dall’interfaccia; dati invariati.",
  );
  process.exit(0);
}
if (phase === "restart") {
  const expected = JSON.parse(await readFile(`${out}/expected.json`, "utf8"));
  assert.deepEqual(await snapshot(), expected.data);
  assert.deepEqual(
    await call("get_interface_preferences"),
    expected.preferences,
  );
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  await selectLocale("en");
  const restorePreferences = { ...expected.preferences, locale: "en" };
  const preview = await call("inspect_backup");
  assert(preview);
  assert.equal(preview.manifest.schema_version, 15);
  await call("cancel_restore");
  await click("Backup e ripristino");
  await click("Seleziona backup");
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await expect(page.locator(".backup-status")).toHaveText(
    await ui("Backup verificato. Conferma o annulla il ripristino."),
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  assert.deepEqual(await snapshot(), expected.data);
  await click("Seleziona backup");
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await expect(page.locator(".backup-status")).toHaveText(
    await ui("Backup verificato. Conferma o annulla il ripristino."),
  );
  await page.screenshot({ path: `${out}/restore-confirmation-en.png` });
  await click("Sostituisci archivio");
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(page.locator(".backup-receipt")).toBeVisible();
  assert.deepEqual(await snapshot(), expected.data);
  assert.deepEqual(await call("get_interface_preferences"), restorePreferences);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.screenshot({ path: `${out}/restart-restore.png` });
  assert.deepEqual(errors, []);
  assert.deepEqual(remote, []);
  await writeFile(
    `${out}/restart-result.json`,
    JSON.stringify(
      {
        restart: true,
        restore: true,
        dataUnchanged: true,
        preferenceOutsideBackup: true,
        backupLocale: "de",
        restoredLocale: "en",
        errors,
        remote,
      },
      null,
      2,
    ),
  );
  await selectLocale("de");
  console.log(
    "PASS: riavvio, ripristino schema 015, preferenze e tutti i dati invariati.",
  );
  process.exit(0);
}
await call("save_interface_preferences", { preferences: plain });
await page.reload();
await expect(page.locator(".campaign-picker select")).toHaveValue(campaign.id);
const initial = await snapshot();
const views = [
  "Riepilogo",
  "Diario",
  "Codex",
  "Grafo",
  "Party",
  "Personaggio",
  "Inventario",
  "Incantesimi",
  "Wiki D&D",
  "Impostazioni della campagna",
  "Assistente locale",
  "Tiradadi",
  "Backup e ripristino",
];
const report = [];
for (const locale of Object.keys(catalogs)) {
  await selectLocale(locale);
  for (const view of views) {
    console.log("VIEW", locale, view);
    await click(view);
    if (view === "Backup e ripristino")
      await page.locator(".backup-workspace").waitFor();
    else await expect(page.locator(".workspace-content")).toBeVisible();
    await page.waitForLoadState("networkidle");
    assert.equal(
      await page.locator("html").getAttribute("dir"),
      locale === "ar" ? "rtl" : "ltr",
    );
    assert.equal(
      await page.locator(".campaign-picker select").inputValue(),
      view === "Backup e ripristino" ? "" : campaign.id,
    );
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth + 2,
    );
    assert(!overflow, `Page overflow ${locale} ${view}`);
  }
  await openPreferences();
  await page.evaluate(() => document.fonts.ready);
  if (["en", "ar", "ja"].includes(locale)) {
    const audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    await writeFile(
      `${out}/axe-${locale}.json`,
      JSON.stringify(audit.violations, null, 2),
    );
    assert.equal(
      audit.violations.length,
      0,
      `${locale}: ${audit.violations.map((v) => v.id)}`,
    );
    await page.screenshot({ path: `${out}/settings-${locale}.png` });
  }
  report.push({ locale, views: views.length, persisted: true });
  console.log("PASS locale", locale);
}
await selectLocale("it");
for (const script of ["braille", "morse", "galactic"]) {
  await page.locator(".language-settings select").nth(1).selectOption(script);
  await expect(page.locator("html")).toHaveAttribute("data-script", script);
  await expect(page.locator(".language-settings select").nth(1)).toBeEnabled();
  await page.locator(".language-checkbox input").click();
  await expect(page.locator(".language-checkbox input")).not.toBeChecked();
  await expect(page.locator(".language-checkbox input")).toBeEnabled();
  if (script === "morse")
    await expect(
      page
        .getByRole("button", { name: "Diario", exact: true })
        .locator(".sr-only"),
    ).toHaveCSS("position", "absolute");
  await page
    .getByRole("button", { name: "Prepara pacchetto reversibile", exact: true })
    .click();
  const packet = await page
    .locator(".transcription-preview textarea")
    .last()
    .inputValue();
  assert.equal(JSON.parse(packet).original, "Chronexus 100");
  await page
    .getByRole("button", {
      name: "Ripristina originale dal pacchetto",
      exact: true,
    })
    .click();
  await page.screenshot({ path: `${out}/script-${script}.png` });
  await page
    .getByRole("button", {
      name: "Italiano · Ripristina lingua e scrittura",
      exact: true,
    })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-script", "standard");
}
await selectLocale("ar");
await page.setViewportSize({ width: 760, height: 600 });
await page.screenshot({ path: `${out}/arabic-minimum.png` });
assert(
  !(await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth + 2,
  )),
);
await page.setViewportSize({ width: 1586, height: 992 });
await selectLocale("de");
assert.deepEqual(await snapshot(), initial);
const backup = await call("create_backup");
assert(backup?.path);
assert.equal(backup.counts.diceRolls, 1);
const preferences = await call("get_interface_preferences");
await writeFile(
  `${out}/expected.json`,
  JSON.stringify({ preferences, data: initial }, null, 2),
);
assert.deepEqual(errors, []);
assert.deepEqual(remote, []);
await writeFile(
  `${out}/native-result.json`,
  JSON.stringify(
    {
      report,
      modes: ["braille", "morse", "galactic"],
      dataUnchanged: true,
      backup,
      errors,
      remote,
    },
    null,
    2,
  ),
);
console.log(
  "PASS: 13 lingue × 13 viste, 3 trascrizioni, RTL, backup e dati invariati.",
);
process.exit(0);
