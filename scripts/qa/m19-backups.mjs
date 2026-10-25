// M19 desktop acceptance on an isolated debug profile only (CDP 9224).
// NODEX_DEV_DOCUMENTS_DIR simulates the Documents folder: the real one is never
// touched. Phases: "auto" (fresh profile), "age" (app closed: makes the last
// backup 3 hours old), "restart" (same profile reopened).
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
assert.equal(process.env.CHRONEXUS_BACKUP_QA, "isolated");
const profile = process.env.NODEX_DEV_DATA_DIR;
const documents = process.env.NODEX_DEV_DOCUMENTS_DIR;
assert(profile && path.isAbsolute(profile));
assert(documents && path.isAbsolute(documents));
const phase = process.argv[2];
assert(["auto", "age", "restart"].includes(phase));
const app = path.join(documents, "Chronexus");
const periodic = path.join(app, "Backup periodici");
const updates = path.join(app, "Backup aggiornamenti");
const indexFile = path.join(profile, "periodic-backups.json");
const pass = (m) => console.log("PASS " + m);
const periodicFiles = () =>
  existsSync(periodic)
    ? readdirSync(periodic)
        .filter((f) => f.startsWith("chronexus-periodico-"))
        .sort()
    : [];
if (phase === "age") {
  const index = JSON.parse(readFileSync(indexFile, "utf8"));
  const old = new Date(Date.now() - 3 * 3600_000).toISOString();
  index.lastSuccess = old;
  index.lastAttempt = old;
  writeFileSync(indexFile, JSON.stringify(index, null, 2));
  pass("last periodic backup aged by 3 hours while the app is closed");
  process.exit(0);
}
const browser = await chromium.connectOverCDP("http://127.0.0.1:9224");
const page = browser
  .contexts()[0]
  .pages()
  .find((p) => p.url().includes("1420"));
assert(page);
const call = (name, args) =>
  page.evaluate(
    ([n, a]) => window.__TAURI_INTERNALS__.invoke(n, a ?? {}),
    [name, args],
  );
const waitFor = async (check, ms, what) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (check()) return;
    await page.waitForTimeout(2000);
  }
  throw new Error("timeout: " + what);
};
const settings = async () => {
  await page.getByRole("button", { name: "Impostazioni dell’app" }).click();
  const region = page.getByRole("region", { name: "Backup", exact: true });
  await region.locator("dl.backup-folder-status").waitFor();
  return region;
};
// 1×1 PNG, synthetic.
const png =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

if (phase === "auto") {
  assert.equal((await call("list_campaigns")).length, 0, "fresh profile");
  const campaign = await call("create_campaign", { name: "Campagna periodica" });
  const map = await call("create_page", {
    campaignId: campaign.id,
    title: "Mappa del porto",
    kind: "place",
    status: "active",
    aliases: [],
  });
  await call("add_image", {
    campaignId: campaign.id,
    target: { kind: "page", id: map.id },
    caption: "Mappa",
    role: "map",
    dataBase64: png,
  });
  const region = await settings();
  await expect(region.getByText("Backup periodici disattivati")).toBeVisible();
  assert(!existsSync(app), "folder not created by opening settings");
  await region.getByRole("checkbox").check();
  await region.getByLabel("Frequenza").selectOption("hours");
  await region.getByLabel(/Ore tra un backup/).fill("2");
  await region.getByLabel(/Copie periodiche da conservare/).fill("2");
  await region.getByRole("button", { name: "Salva pianificazione" }).click();
  await expect(
    region.getByText("Pianificazione dei backup salvata."),
  ).toBeVisible();
  await expect(
    region.getByText("Al prossimo momento di inattività"),
  ).toBeVisible();
  pass("schedule saved from the settings without a campaign selected");
  // The user is typing: no backup while a text field has focus.
  await region.getByLabel(/Copie periodiche da conservare/).focus();
  await page.waitForTimeout(100_000);
  assert(!existsSync(app), "no backup (nor folder) while editing");
  pass("periodic backup skipped during activity; folder still not created");
  await page.evaluate(() => document.activeElement?.blur());
  await waitFor(() => periodicFiles().length === 1, 150_000, "auto backup");
  await expect(
    page.getByText("Backup periodico creato e verificato."),
  ).toBeVisible();
  await expect(region.getByText("Nessuno finora")).toHaveCount(0);
  pass("automatic periodic backup after idle: " + periodicFiles()[0]);
  copyFileSync(
    path.join(periodic, periodicFiles()[0]),
    path.join(periodic, "manuale.nodex"),
  );
  await page.getByRole("button", { name: "Chiudi" }).click();
  for (let i = 0; i < 2; i++) {
    const known = periodicFiles().join();
    await region.getByRole("button", { name: "Esegui backup ora" }).click();
    await waitFor(() => periodicFiles().join() !== known, 60_000, "run now");
    await expect(
      region.getByRole("button", { name: "Esegui backup ora" }),
    ).toBeEnabled();
  }
  assert.equal(periodicFiles().length, 2, "rotation keeps 2 copies");
  assert(existsSync(path.join(periodic, "manuale.nodex")), "manual kept");
  pass("rotation limited to registered files; manual copy untouched");
  const legacy = path.join(profile, "update-backups");
  mkdirSync(legacy, { recursive: true });
  copyFileSync(
    path.join(periodic, periodicFiles()[0]),
    path.join(legacy, "before-update-qa.nodex"),
  );
  pass("legacy update backup prepared for the restart phase");
} else {
  const before = periodicFiles();
  const region = await settings();
  await expect(region.getByRole("checkbox")).toBeChecked();
  await expect(
    region.getByText("Al prossimo momento di inattività"),
  ).toBeVisible();
  pass("preferences persisted; overdue backup pending after restart");
  await waitFor(
    () => periodicFiles().join() !== before.join(),
    150_000,
    "backup resumed after restart",
  );
  assert.equal(periodicFiles().length, 2);
  pass("overdue periodic backup ran after restart once idle");
  await call("create_campaign", { name: "Dopo il backup" });
  await page.getByRole("button", { name: "Backup e ripristino" }).click();
  const list = page.getByRole("region", {
    name: "Backup nelle cartelle di Chronexus",
  });
  await list.getByRole("button", { name: "Aggiorna elenco" }).click();
  await list.getByRole("button", { name: "Copia nei Documenti" }).click();
  await expect(page.getByText(/L’originale resta nella cartella dati/)).toBeVisible();
  assert(existsSync(path.join(updates, "before-update-qa.nodex")));
  assert(existsSync(path.join(profile, "update-backups", "before-update-qa.nodex")));
  pass("legacy update backup copied with SHA-256, original kept");
  const newest = periodicFiles().at(-1);
  await list
    .getByRole("button", { name: `Verifica e ripristina ${newest}` })
    .click();
  const dialog = page.getByRole("alertdialog");
  await dialog.waitFor();
  await dialog.getByRole("button", { name: "Sostituisci archivio" }).click();
  await expect(page.getByText("Archivio ripristinato")).toBeVisible({
    timeout: 60_000,
  });
  const campaigns = await call("list_campaigns");
  assert.deepEqual(
    campaigns.map((c) => c.name),
    ["Campagna periodica"],
  );
  const pages = await call("list_pages", { campaignId: campaigns[0].id });
  const images = await call("list_images", {
    campaignId: campaigns[0].id,
    target: { kind: "page", id: pages[0].id },
  });
  assert.equal(images.length, 1, "image restored");
  const prefs = JSON.parse(
    readFileSync(path.join(profile, "backup-preferences.json"), "utf8"),
  );
  assert(prefs.enabled && prefs.keep === 2 && prefs.hours === 2);
  pass("periodic backup with image restored; preferences unaffected");
}
await browser.close();
