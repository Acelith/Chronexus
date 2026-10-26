// M20: seeds the synthetic campaign «Varek’s Tower» in an EMPTY isolated
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
assert.equal((await call("get_interface_preferences")).locale, "en");
const campaign = await call("create_campaign", { name: "Varek’s Tower" });
const c = campaign.id;
const pages = {};
for (const [key, title, kind, aliases] of [
  ["varek", "Varek the Cartographer", "npc", ["The Cartographer"]],
  ["gilda", "Cartographers’ Guild", "faction", []],
  ["porto", "Salt Harbor", "place", []],
  ["sigillo", "Amber Seal", "item", []],
  ["mappa", "The Lost Map", "quest", []],
  ["ilenia", "Master Ilenia", "npc", []],
  ["torre", "Varek’s Tower", "place", []],
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
    "Arrival at Salt Harbor",
    [
      block("heading", [text("Landing at dawn")], { level: 2 }),
      block("paragraph", [
        text("The ferry leaves us at "),
        mention("porto"),
        text(
          ". In the mist, a man with an astrolabe is waiting: he introduces himself as ",
        ),
        mention("varek"),
        text("."),
      ]),
      block("paragraph", [
        text("He says he works for the "),
        mention("gilda"),
        text(" and offers to take us to "),
        mention("torre"),
        text("."),
      ]),
      block("quote", [
        text("“Whoever draws the maps decides where the world ends.”"),
      ]),
    ],
  ],
  [
    "The Cartographer’s Workshop",
    [
      block("heading", [text("Clues gathered")], { level: 2 }),
      block("bulletListItem", [
        text("On the desk of "),
        mention("varek"),
        text(" lies a torn parchment: perhaps "),
        mention("mappa"),
        text("."),
      ]),
      block("bulletListItem", [
        text("The wax seal bears the crest of the "),
        mention("gilda"),
        text("."),
      ]),
      block("bulletListItem", [
        mention("ilenia"),
        text(" suspects that Varek is hiding something."),
      ]),
      block("checkListItem", [text("Ask Ilenia who commissioned the map")], {
        checked: false,
      }),
      block(
        "checkListItem",
        [
          text("Find the "),
          mention("sigillo"),
          text(" in the harbor warehouses"),
        ],
        { checked: true },
      ),
      block("paragraph", [
        bold("Unverified: "),
        text("Varek claims he has never seen the complete map."),
      ]),
    ],
  ],
  [
    "The Amber Seal",
    [
      block("paragraph", [
        text("In the warehouses at "),
        mention("porto"),
        text(" we find the "),
        mention("sigillo"),
        text(". Ilenia entrusts it to us in exchange for a promise to return "),
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
  "works for",
  "confirmed",
  "He says so himself, and the seal supports his claim.",
);
await rel(
  "ilenia",
  "varek",
  "suspects",
  "suspected",
  "Ilenia thinks he is withholding information.",
);
await rel(
  "sigillo",
  "porto",
  "kept at",
  "confirmed",
  "Found in the warehouses.",
);
await rel(
  "mappa",
  "torre",
  "possibly hidden in",
  "unknown",
  "Only a hypothesis from the party.",
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
    name: "Oran of Valmora",
    systemId: "dnd5e-2014",
    vocation: "Bard",
    ancestry: "Half-elf",
    level: 5,
    experience: 6500,
    hpCurrent: 31,
    hpMaximum: 38,
    hpTemporary: 4,
    stats: [
      stat("Strength", "10", "+0"),
      stat("Dexterity", "14", "+2"),
      stat("Constitution", "13", "+1"),
      stat("Intelligence", "12", "+1"),
      stat("Wisdom", "11", "+0"),
      stat("Charisma", "17", "+3"),
    ],
    resources: [
      {
        id: randomUUID(),
        label: "Bardic inspiration",
        kind: "resource",
        current: 2,
        maximum: 3,
      },
      {
        id: randomUUID(),
        label: "1st-level slots",
        kind: "slot",
        current: 3,
        maximum: 4,
      },
      {
        id: randomUUID(),
        label: "2nd-level slots",
        kind: "slot",
        current: 1,
        maximum: 3,
      },
    ],
    conditions: "",
    notes: "Searching for the lost map on behalf of Master Ilenia.",
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
      name: "Amber Seal",
      quantity: 1,
      category: "Quest item",
      description: "Amber sealing wax bearing the Guild crest.",
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
      provenanceNotes: "Entrusted by Master Ilenia.",
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
await page.getByRole("button", { name: "Journal", exact: true }).click();
await page
  .locator(".session-list button")
  .filter({ hasText: "The Cartographer’s Workshop" })
  .click();
await page.getByRole("toolbar", { name: "Note commands" }).waitFor();
await page.waitForTimeout(800);
await page.screenshot({ path: ".tools/m20/hero.png" });
await page.getByRole("button", { name: "Graph", exact: true }).click();
await page.waitForTimeout(2500);
await page.screenshot({ path: ".tools/m20/graph.png" });
await page.getByRole("button", { name: "Character", exact: true }).click();
await page.getByRole("heading", { name: "Oran of Valmora" }).waitFor();
await page.waitForTimeout(500);
await page.screenshot({ path: ".tools/m20/character.png" });
await page.getByRole("button", { name: "Dice roller" }).click();
await page.waitForTimeout(800);
await page.screenshot({ path: ".tools/m20/dice.png" });
await cdp.send("Emulation.clearDeviceMetricsOverride");
console.log("PASS seeded synthetic campaign and captured 4 screenshots");
await browser.close();
