// Real Chronexus WebView2 + Tauri + SQLite. Only file chooser results can be
// predefined via NODEX_DEV_*_FILE in debug; no persistence or command mocks.
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID, createHash } from "node:crypto";
import path from "node:path";
const phase = process.argv[2];
const sourceRoot = path.resolve(
  process.env.NODEX_SMOKE_SOURCE || ".tools/m5-source",
);
const restoredRoot = path.resolve(
  process.env.NODEX_SMOKE_RESTORED || ".tools/m5-restored",
);
const bundleFile = path.resolve(
  process.env.NODEX_SMOKE_BACKUP || ".tools/m5-portable.nodex",
);
assert(bundleFile.startsWith(path.resolve(".tools") + path.sep));
for (const root of [sourceRoot, restoredRoot])
  assert(root.startsWith(path.resolve(".tools") + path.sep));
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
        .find((p) => p.url().startsWith("http://127.0.0.1:1420"));
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
const invoke = (name, args) =>
  page.evaluate(
    ({ name, args }) => window.__TAURI_INTERNALS__.invoke(name, args),
    { name, args },
  );
const expectationFile = ".tools/player-expectation.json";
const query = {
  kind: null,
  edgeKind: "all",
  certainty: null,
  focusId: null,
  depth: 1,
  sessionId: null,
  search: "",
};
async function capture() {
  const campaigns = await invoke("list_campaigns");
  const campaign = campaigns.find((c) => c.name === "Verifica M5 Chronexus");
  assert(campaign);
  const character = await invoke("get_character", { campaignId: campaign.id });
  assert(character);
  return {
    campaigns,
    character,
    assets: await invoke("list_player_assets", {
      campaignId: campaign.id,
      characterId: character.id,
    }),
    pages: await invoke("list_pages", { campaignId: campaign.id }),
    sessions: await invoke("list_sessions", { campaignId: campaign.id }),
    graph: await invoke("get_graph", { campaignId: campaign.id, query }),
  };
}
async function fill(label, value) {
  await page.getByLabel(label, { exact: true }).fill(String(value));
}
async function tab(name) {
  await page.getByRole("button", { name, exact: true }).click();
}
async function saved() {
  await expect(
    page.locator(".player-workspace").getByRole("status").first(),
  ).toHaveText("Saved on the computer.");
}
const detail = () =>
  page.getByRole("article", { name: "Entry details", exact: true });
async function selectItem(name) {
  await page
    .getByRole("navigation", { name: "Character entries" })
    .getByRole("button", { name: new RegExp(name) })
    .click();
}
async function close() {
  await invoke("plugin:window|close", { label: "main" }).catch((e) => {
    if (!String(e).includes("closed")) throw e;
  });
}
async function assertCharacter(data) {
  await tab("Character");
  await expect(
    page.getByRole("heading", { name: "Neme", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Hit points", { exact: true })).toHaveText(
    `${data.character.data.hpCurrent} / 10`,
  );
  await expect(page.getByLabel("Focus", { exact: true })).toHaveText("2 / 3");
  await expect(page.getByLabel("First circle", { exact: true })).toHaveText(
    "0 / 2",
  );
}
async function assertContextNavigation() {
  await tab("Inventory");
  await selectItem("Gate key");
  await detail()
    .getByRole("button", { name: "PNG: Varek", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Varek", exact: true }),
  ).toBeVisible();
  await tab("Back to the character entry");
  await expect(
    detail().getByRole("heading", { name: "Gate key", exact: true }),
  ).toBeVisible();
  await detail()
    .getByRole("button", { name: "Open source session at block", exact: true })
    .click();
  await expect(page.locator('[data-id="m5-key-source"]').first()).toBeVisible();
  const focused = await page.evaluate(() =>
    window
      .getSelection()
      ?.anchorNode?.parentElement?.closest("[data-id]")
      ?.getAttribute("data-id"),
  );
  assert.equal(focused, "m5-key-source");
  await tab("Back to the character entry");
  await expect(
    detail().getByRole("heading", { name: "Gate key", exact: true }),
  ).toBeVisible();
}
if (phase === "prepare") {
  assert.deepEqual(
    await invoke("list_campaigns"),
    [],
    "Richiesto profilo .tools/m5-source vuoto",
  );
  const campaign = await invoke("create_campaign", {
    name: "Verifica M5 Chronexus",
  });
  const newPage = (title, kind) =>
    invoke("create_page", {
      campaignId: campaign.id,
      title,
      kind,
      status: "active",
      aliases: [],
    });
  const npc = await newPage("Varek", "npc"),
    place = await newPage("Ponte", "place"),
    quest = await newPage("Open the gate", "quest"),
    itemPage = await newPage("Gate key", "item"),
    spellPage = await newPage("Faint light", "note");
  const session = await invoke("create_session", {
    campaignId: campaign.id,
    sequence: 12,
    title: "Varek’s key",
    playedOn: "2026-10-23",
  });
  const document = {
    version: 1,
    blocks: [
      {
        id: "m5-first",
        type: "paragraph",
        props: {},
        children: [],
        content: [
          { type: "text", text: "We reached the bridge.", styles: {} },
        ],
      },
      {
        id: "m5-key-source",
        type: "paragraph",
        props: {},
        children: [],
        content: [
          {
            type: "text",
            text: "Varek handed me the gate key. ",
            styles: {},
          },
          { type: "pageMention", props: { pageId: npc.id, label: "Varek" } },
        ],
      },
    ],
  };
  await invoke("save_document", {
    campaignId: campaign.id,
    id: session.id,
    revision: 0,
    document,
  });
  await page.reload();
  await tab("Character");
  await tab("Create character");
  await fill("Character name", "Neme");
  await fill("Rules system", "Company handbook");
  await fill("Origin or species", "Viandante");
  await fill("Class or calling", "Esploratrice");
  await fill("Level (optional)", 2);
  await fill("Maximum HP", 10);
  await fill("Current HP", 8);
  await fill("Temporary HP", 2);
  await tab("Add statistic");
  await fill("Statistic 1: name", "Defense");
  await page
    .getByLabel("Statistica 1: categoria", { exact: true })
    .selectOption("defense");
  await fill("Statistica 1: valore", "12 manuale");
  await tab("Add resource");
  await fill("Resource 1: name", "Focus");
  await fill("Risorsa 1: massimo", 3);
  await fill("Risorsa 1: attuale", 2);
  await tab("Add resource");
  await fill("Resource 2: name", "First circle");
  await page
    .getByLabel("Risorsa 2: tipo", { exact: true })
    .selectOption("slot");
  await fill("Risorsa 2: massimo", 2);
  await fill("Risorsa 2: attuale", 1);
  await fill("Conditions", "Tired, according to my house rules.");
  await fill("Character notes", "Personal sheet notes.");
  await tab("Save character");
  await saved();
  await tab("Decrease Hit points");
  await expect(page.getByLabel("Hit points", { exact: true })).toHaveText(
    "7 / 10",
  );
  await tab("Decrease Focus");
  await expect(page.getByLabel("Focus", { exact: true })).toHaveText("1 / 3");
  await tab("Increase Focus");
  await expect(page.getByLabel("Focus", { exact: true })).toHaveText("2 / 3");
  await tab("Decrease First circle");
  await expect(page.getByLabel("First circle", { exact: true })).toHaveText(
    "0 / 2",
  );
  await expect(
    page.getByRole("button", { name: "Decrease First circle", exact: true }),
  ).toBeDisabled();
  const characterBeforeAbilities = await invoke("get_character", {
    campaignId: campaign.id,
  });
  await page.screenshot({ path: ".tools/m5-character.png", fullPage: true });
  console.log(
    "PASS sheet, statistics, HP, resources and slots with real persistence",
  );
  await tab("Inventory");
  await tab("Add item");
  await fill("Entry name", "Gate key");
  await fill("Quantity", 2);
  await fill("Item category", "Chiavi");
  await fill("Weight (your own unit, optional)", 0.2);
  await fill("Value or currency (free text)", "Two noted coins");
  await fill("Description", "A key handed over by Varek.");
  for (const [label, value] of [
    ["Linked NPC", npc.id],
    ["Linked place", place.id],
    ["Linked quest", quest.id],
    ["Codex page of the entry", itemPage.id],
    ["Source session", session.id],
    ["Source block", "m5-key-source"],
  ])
    await page.getByLabel(label, { exact: true }).selectOption(value);
  await fill("Provenance notes", "Received in Session 12, not bought.");
  await tab("Character");
  await expect(page.getByRole("alert")).toContainText("Save or cancel");
  await expect(page.getByLabel("Entry name", { exact: true })).toHaveValue(
    "Gate key",
  );
  await tab("Close message");
  await tab("Save entry");
  await saved();
  await tab("Increase Quantity");
  await expect(detail().getByLabel("Quantity", { exact: true })).toHaveText(
    "3",
  );
  await tab("Decrease Quantity");
  await expect(detail().getByLabel("Quantity", { exact: true })).toHaveText(
    "2",
  );
  await tab("Equip");
  await saved();
  await expect(detail()).toContainText("Equipped");
  await tab("Add item");
  await fill("Entry name", "Test case");
  await fill("Quantity", 0);
  await tab("Save entry");
  await saved();
  await expect(detail().getByLabel("Quantity", { exact: true })).toHaveText(
    "0",
  );
  await assertContextNavigation(); // Return must keep the key selected, not the first item.
  await detail()
    .getByRole("button", {
      name: "Codex page: Gate key",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "Gate key", exact: true }),
  ).toBeVisible();
  await tab("Back to the character entry");
  await selectItem("Test case");
  await tab("Delete entry");
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await tab("Delete entry");
  await tab("Confirm deletion");
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(
    detail().getByRole("heading", { name: "Gate key", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: ".tools/m5-inventory.png", fullPage: true });
  console.log(
    "PASS inventory, zero quantity, equipment, deletion confirmation and source navigation with return",
  );
  await tab("Abilities");
  await tab("Add spell");
  await fill("Entry name", "Faint light");
  await fill("Level or rank (free text)", "First circle");
  await fill("School or tradition", "Light");
  await fill("Activation time", "One gesture");
  await fill("Duration", "A brief moment");
  await fill("Range", "Near");
  await fill("Components", "Voice");
  await fill("Description", "Original text, without commercial rules.");
  await page.getByLabel("Known", { exact: true }).check();
  await page.getByLabel("Prepared", { exact: true }).check();
  await page
    .getByLabel("Codex page of the entry", { exact: true })
    .selectOption(spellPage.id);
  await tab("Save entry");
  await saved();
  await page
    .getByLabel("Status or type", { exact: true })
    .selectOption("prepared");
  await expect(detail()).toContainText("Known · Prepared");
  await tab("Toggle prepared");
  await expect(
    page.getByText("No entries match the filters.", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Status or type", { exact: true }).selectOption("all");
  await tab("Add ability");
  await fill("Entry name", "Careful step");
  await fill("Level or rank (free text)", "Personal talent");
  await page.getByLabel("Prepared", { exact: true }).check();
  await tab("Save entry");
  await saved();
  await fill("Search by name", "Careful");
  await fill("Filter by level", "Personal");
  await expect(detail()).toContainText(
    "Not marked as known · Prepared",
  );
  assert.deepEqual(
    await invoke("get_character", { campaignId: campaign.id }),
    characterBeforeAbilities,
    "Abilities must not consume resources automatically",
  );
  const data = await capture();
  assert.equal(
    data.graph.edges.filter((e) => e.kind === "assertion").length,
    0,
  );
  assert.equal(data.assets.length, 3);
  const attachment = `attachments/${campaign.id}/${randomUUID()}.png`;
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZukAAAAASUVORK5CYII=",
    "base64",
  );
  await mkdir(path.dirname(path.join(sourceRoot, attachment)), {
    recursive: true,
  });
  await writeFile(path.join(sourceRoot, attachment), png);
  await writeFile(
    expectationFile,
    JSON.stringify({
      data,
      attachment,
      attachmentHash: createHash("sha256").update(png).digest("hex"),
    }),
  );
  await page.screenshot({ path: ".tools/m5-abilities.png", fullPage: true });
  await tab("Backup and restore");
  await tab("Create backup");
  const receipt = page.getByRole("region", {
    name: "Backup created",
    exact: true,
  });
  await expect(receipt).toBeVisible();
  await expect(receipt.getByText("Characters", { exact: true })).toBeVisible();
  assert((await readFile(bundleFile)).length > 0);
  await close();
  console.log(
    "PASS abilities, filters, no automatic rules, M5 backup with image",
  );
} else {
  const expected = JSON.parse(await readFile(expectationFile, "utf8"));
  if (phase === "restore") {
    assert.deepEqual(
      await invoke("list_campaigns"),
      [],
      "Richiesto profilo .tools/m5-restored vuoto",
    );
    await tab("Backup and restore");
    await tab("Select backup");
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await expect(
      page.getByRole("alertdialog").getByText("Characters", { exact: true }),
    ).toBeVisible();
    await tab("Replace archive");
    await expect(
      page.getByRole("region", { name: "Restore completed", exact: true }),
    ).toBeVisible();
    assert.deepEqual(await capture(), expected.data);
    await close();
    console.log("PASS M5 restore into an empty profile with safety copy");
  } else {
    assert.deepEqual(await capture(), expected.data);
    await assertCharacter(expected.data);
    await assertContextNavigation();
    const root = phase === "verify-restored" ? restoredRoot : sourceRoot;
    const pointer = await readFile(
      path.join(root, "active-profile.json"),
      "utf8",
    )
      .then(JSON.parse)
      .catch((e) => {
        if (e.code === "ENOENT") return null;
        throw e;
      });
    const directory = pointer ? path.join(root, "profiles", pointer) : root;
    assert.equal(
      createHash("sha256")
        .update(await readFile(path.join(directory, expected.attachment)))
        .digest("hex"),
      expected.attachmentHash,
    );
    await page.screenshot({ path: `.tools/m5-${phase}.png`, fullPage: true });
    await close();
    console.log(
      `PASS ${phase}: sheet/assets/documents/graph identical, image intact, sources and return navigation working`,
    );
  }
}
assert.deepEqual(errors, [], "Errori runtime WebView");
await browser.close();
