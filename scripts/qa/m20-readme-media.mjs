// M20: seeds the synthetic campaign «La Torre di Varek» in an EMPTY isolated
// debug profile (CDP 9224) and captures README screenshots into .tools/m20/.
// Never run it on a personal archive: it refuses any existing campaign.
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
assert.equal(process.env.CHRONEXUS_README_QA, "isolated");
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
assert.equal(
  (await call("list_campaigns")).length,
  0,
  "empty profile required",
);
const campaign = await call("create_campaign", { name: "La Torre di Varek" });
const c = campaign.id;
const pages = {};
for (const [key, title, kind, aliases] of [
  ["varek", "Varek il Cartografo", "npc", ["Il Cartografo"]],
  ["gilda", "Gilda dei Cartografi", "faction", []],
  ["porto", "Porto di Sale", "place", []],
  ["sigillo", "Sigillo d’ambra", "item", []],
  ["mappa", "La mappa perduta", "quest", []],
  ["ilenia", "Maestra Ilenia", "npc", []],
  ["torre", "Torre di Varek", "place", []],
])
  pages[key] = await call("create_page", {
    campaignId: c,
    title,
    kind,
    status: "active",
    aliases,
  });
const text = (t) => ({ type: "text", text: t, styles: {} });
const bold = (t) => ({ type: "text", text: t, styles: { bold: true } });
const mention = (k) => ({
  type: "pageMention",
  props: { pageId: pages[k].id, label: pages[k].title },
});
const block = (type, content, props = {}) => ({
  id: randomUUID(),
  type,
  props,
  content,
  children: [],
});
const sessions = [
  [
    "Arrivo al Porto di Sale",
    [
      block("heading", [text("Sbarco all’alba")], { level: 2 }),
      block("paragraph", [
        text("Il traghetto ci lascia al "),
        mention("porto"),
        text(
          ". Nella nebbia, un uomo con un astrolabio ci aspetta: si presenta come ",
        ),
        mention("varek"),
        text("."),
      ]),
      block("paragraph", [
        text("Dice di lavorare per la "),
        mention("gilda"),
        text(" e ci offre un passaggio fino alla sua "),
        mention("torre"),
        text("."),
      ]),
      block("quote", [
        text("«Chi disegna le mappe decide dove finisce il mondo.»"),
      ]),
    ],
  ],
  [
    "La bottega del Cartografo",
    [
      block("heading", [text("Indizi raccolti")], { level: 2 }),
      block("bulletListItem", [
        text("Sul tavolo di "),
        mention("varek"),
        text(" c’è una pergamena strappata: forse "),
        mention("mappa"),
        text("."),
      ]),
      block("bulletListItem", [
        text("Il sigillo in ceralacca porta lo stemma della "),
        mention("gilda"),
        text("."),
      ]),
      block("bulletListItem", [
        mention("ilenia"),
        text(" sospetta che Varek nasconda qualcosa."),
      ]),
      block(
        "checkListItem",
        [text("Chiedere a Ilenia chi ha commissionato la mappa")],
        { checked: false },
      ),
      block(
        "checkListItem",
        [
          text("Cercare il "),
          mention("sigillo"),
          text(" nei magazzini del porto"),
        ],
        { checked: true },
      ),
      block("paragraph", [
        bold("Da verificare: "),
        text("Varek dice di non aver mai visto la mappa intera."),
      ]),
    ],
  ],
  [
    "Il sigillo d’ambra",
    [
      block("paragraph", [
        text("Nei magazzini del "),
        mention("porto"),
        text(" troviamo il "),
        mention("sigillo"),
        text(
          ". Ilenia ce lo affida in cambio della promessa di riportarle la ",
        ),
        mention("mappa"),
        text("."),
      ]),
    ],
  ],
];
const created = [];
for (const [i, [title, blocks]] of sessions.entries()) {
  const s = await call("create_session", {
    campaignId: c,
    sequence: i + 1,
    title,
    playedOn: `2026-10-${10 + i * 7}`,
  });
  await call("save_document", {
    campaignId: c,
    id: s.id,
    revision: s.revision ?? 0,
    document: { version: 1, blocks },
  });
  created.push(s);
}
const rel = (from, to, label, certainty, evidence) =>
  call("save_relationship", {
    campaignId: c,
    id: null,
    revision: null,
    input: {
      fromPageId: pages[from].id,
      toPageId: pages[to].id,
      label,
      certainty,
      sourceKind: "session",
      sourceId: created[1].id,
      sourceBlockId: null,
      evidence,
      notes: "",
    },
  });
await rel(
  "varek",
  "gilda",
  "lavora per",
  "confirmed",
  "Lo dice lui stesso e il sigillo lo conferma.",
);
await rel(
  "ilenia",
  "varek",
  "sospetta di",
  "suspected",
  "Ilenia lo ritiene reticente.",
);
await rel(
  "sigillo",
  "porto",
  "custodito a",
  "confirmed",
  "Trovato nei magazzini.",
);
await rel(
  "mappa",
  "torre",
  "forse nascosta in",
  "unknown",
  "Solo un’ipotesi del gruppo.",
);
const stat = (label, value, modifier) => ({
  id: randomUUID(),
  label,
  value,
  modifier,
  training: "none",
  group: "ability",
});
const character = await call("save_character", {
  campaignId: c,
  id: null,
  revision: null,
  input: {
    name: "Oran di Valmora",
    systemId: "dnd5e-2014",
    vocation: "Bardo",
    ancestry: "Mezzelfo",
    level: 5,
    experience: 6500,
    hpCurrent: 31,
    hpMaximum: 38,
    hpTemporary: 4,
    stats: [
      stat("Forza", "10", "+0"),
      stat("Destrezza", "14", "+2"),
      stat("Costituzione", "13", "+1"),
      stat("Intelligenza", "12", "+1"),
      stat("Saggezza", "11", "+0"),
      stat("Carisma", "17", "+3"),
    ],
    resources: [
      {
        id: randomUUID(),
        label: "Ispirazione bardica",
        kind: "resource",
        current: 2,
        maximum: 3,
      },
      {
        id: randomUUID(),
        label: "Slot di 1° livello",
        kind: "slot",
        current: 3,
        maximum: 4,
      },
      {
        id: randomUUID(),
        label: "Slot di 2° livello",
        kind: "slot",
        current: 1,
        maximum: 3,
      },
    ],
    conditions: "",
    notes: "Cerca la mappa perduta per conto di Maestra Ilenia.",
    sheet: {
      fields: {},
      inspiration: true,
      deathSuccesses: 0,
      deathFailures: 0,
      attacks: [],
    },
  },
});
await call("save_player_asset", {
  campaignId: c,
  characterId: character.id,
  id: null,
  revision: null,
  input: {
    details: {
      kind: "item",
      name: "Sigillo d’ambra",
      quantity: 1,
      category: "Oggetto di missione",
      description: "Ceralacca ambrata con lo stemma della Gilda.",
      weight: null,
      value: "",
      equipped: false,
      consumable: false,
      notes: "",
      location: "Borsa",
    },
    links: {
      pageId: pages.sigillo.id,
      sourceSessionId: created[2].id,
      sourceBlockId: null,
      npcId: pages.ilenia.id,
      placeId: pages.porto.id,
      questId: pages.mappa.id,
      provenanceNotes: "Affidato da Maestra Ilenia.",
    },
  },
});
for (const selections of [
  [{ sides: 20, quantity: 1 }],
  [
    { sides: 6, quantity: 3 },
    { sides: 8, quantity: 1 },
  ],
])
  await call("roll_dice", {
    campaignId: c,
    requestId: randomUUID(),
    selections,
  });

await mkdir(".tools/m20", { recursive: true });
const cdp = await page.context().newCDPSession(page);
await cdp.send("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});
await cdp.send("Emulation.setEmulatedMedia", {
  features: [{ name: "prefers-reduced-motion", value: "reduce" }],
});
await page.reload();
await page.getByRole("button", { name: "Diario", exact: true }).click();
await page
  .locator(".session-list button")
  .filter({ hasText: "La bottega del Cartografo" })
  .click();
await page.getByRole("toolbar", { name: "Comandi degli appunti" }).waitFor();
await page.waitForTimeout(800);
await page.screenshot({ path: ".tools/m20/hero.png" });
await page.getByRole("button", { name: "Grafo", exact: true }).click();
await page.waitForTimeout(2500);
await page.screenshot({ path: ".tools/m20/graph.png" });
await page.getByRole("button", { name: "Personaggio", exact: true }).click();
await page.getByRole("heading", { name: "Oran di Valmora" }).waitFor();
await page.waitForTimeout(500);
await page.screenshot({ path: ".tools/m20/character.png" });
await page.getByRole("button", { name: "Tiradadi" }).click();
await page.waitForTimeout(800);
await page.screenshot({ path: ".tools/m20/dice.png" });
await cdp.send("Emulation.clearDeviceMetricsOverride");
console.log("PASS seeded synthetic campaign and captured 4 screenshots");
await browser.close();
