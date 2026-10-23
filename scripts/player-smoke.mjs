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
  ).toHaveText("Salvato sul computer.");
}
const detail = () =>
  page.getByRole("article", { name: "Dettaglio voce", exact: true });
async function selectItem(name) {
  await page
    .getByRole("navigation", { name: "Voci del personaggio" })
    .getByRole("button", { name: new RegExp(name) })
    .click();
}
async function close() {
  await invoke("plugin:window|close", { label: "main" }).catch((e) => {
    if (!String(e).includes("closed")) throw e;
  });
}
async function assertCharacter(data) {
  await tab("Personaggio");
  await expect(
    page.getByRole("heading", { name: "Neme", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Punti vita", { exact: true })).toHaveText(
    `${data.character.data.hpCurrent} / 10`,
  );
  await expect(page.getByLabel("Focus", { exact: true })).toHaveText("2 / 3");
  await expect(page.getByLabel("Primo cerchio", { exact: true })).toHaveText(
    "0 / 2",
  );
}
async function assertContextNavigation() {
  await tab("Inventario");
  await selectItem("Chiave del portone");
  await detail()
    .getByRole("button", { name: "PNG: Varek", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Varek", exact: true }),
  ).toBeVisible();
  await tab("Torna alla voce del personaggio");
  await expect(
    detail().getByRole("heading", { name: "Chiave del portone", exact: true }),
  ).toBeVisible();
  await detail()
    .getByRole("button", { name: "Apri sessione fonte al blocco", exact: true })
    .click();
  await expect(page.locator('[data-id="m5-key-source"]').first()).toBeVisible();
  const focused = await page.evaluate(() =>
    window
      .getSelection()
      ?.anchorNode?.parentElement?.closest("[data-id]")
      ?.getAttribute("data-id"),
  );
  assert.equal(focused, "m5-key-source");
  await tab("Torna alla voce del personaggio");
  await expect(
    detail().getByRole("heading", { name: "Chiave del portone", exact: true }),
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
    quest = await newPage("Aprire il portone", "quest"),
    itemPage = await newPage("Chiave del portone", "item"),
    spellPage = await newPage("Luce tenue", "note");
  const session = await invoke("create_session", {
    campaignId: campaign.id,
    sequence: 12,
    title: "La chiave di Varek",
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
          { type: "text", text: "Siamo arrivati al ponte.", styles: {} },
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
            text: "Varek mi ha consegnato la chiave del portone. ",
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
  await tab("Personaggio");
  await tab("Crea personaggio");
  await fill("Nome del personaggio", "Neme");
  await fill("Regolamento", "Manuale della compagnia");
  await fill("Origine o specie", "Viandante");
  await fill("Classe o vocazione", "Esploratrice");
  await fill("Livello (facoltativo)", 2);
  await fill("PF massimi", 10);
  await fill("PF attuali", 8);
  await fill("PF temporanei", 2);
  await tab("Aggiungi statistica");
  await fill("Statistica 1: nome", "Difesa");
  await page
    .getByLabel("Statistica 1: categoria", { exact: true })
    .selectOption("defense");
  await fill("Statistica 1: valore", "12 manuale");
  await tab("Aggiungi risorsa");
  await fill("Risorsa 1: nome", "Focus");
  await fill("Risorsa 1: massimo", 3);
  await fill("Risorsa 1: attuale", 2);
  await tab("Aggiungi risorsa");
  await fill("Risorsa 2: nome", "Primo cerchio");
  await page
    .getByLabel("Risorsa 2: tipo", { exact: true })
    .selectOption("slot");
  await fill("Risorsa 2: massimo", 2);
  await fill("Risorsa 2: attuale", 1);
  await fill("Condizioni", "Stanca, secondo il mio regolamento.");
  await fill("Note del personaggio", "Appunti personali della scheda.");
  await tab("Salva personaggio");
  await saved();
  await tab("Riduci Punti vita");
  await expect(page.getByLabel("Punti vita", { exact: true })).toHaveText(
    "7 / 10",
  );
  await tab("Riduci Focus");
  await expect(page.getByLabel("Focus", { exact: true })).toHaveText("1 / 3");
  await tab("Aumenta Focus");
  await expect(page.getByLabel("Focus", { exact: true })).toHaveText("2 / 3");
  await tab("Riduci Primo cerchio");
  await expect(page.getByLabel("Primo cerchio", { exact: true })).toHaveText(
    "0 / 2",
  );
  await expect(
    page.getByRole("button", { name: "Riduci Primo cerchio", exact: true }),
  ).toBeDisabled();
  const characterBeforeAbilities = await invoke("get_character", {
    campaignId: campaign.id,
  });
  await page.screenshot({ path: ".tools/m5-character.png", fullPage: true });
  console.log(
    "PASS scheda, statistiche, PF, risorse e slot con salvataggio reale",
  );
  await tab("Inventario");
  await tab("Aggiungi oggetto");
  await fill("Nome della voce", "Chiave del portone");
  await fill("Quantità", 2);
  await fill("Categoria oggetto", "Chiavi");
  await fill("Peso (unità personale, facoltativo)", 0.2);
  await fill("Valore o valuta (testo libero)", "Due monete annotate");
  await fill("Descrizione", "Una chiave consegnata da Varek.");
  for (const [label, value] of [
    ["PNG collegato", npc.id],
    ["Luogo collegato", place.id],
    ["Missione collegata", quest.id],
    ["Pagina della voce nel Codex", itemPage.id],
    ["Sessione fonte", session.id],
    ["Blocco fonte", "m5-key-source"],
  ])
    await page.getByLabel(label, { exact: true }).selectOption(value);
  await fill(
    "Note di provenienza",
    "Ricevuta nella Sessione 12, non acquistata.",
  );
  await tab("Personaggio");
  await expect(page.getByRole("alert")).toContainText("Salva o annulla");
  await expect(page.getByLabel("Nome della voce", { exact: true })).toHaveValue(
    "Chiave del portone",
  );
  await tab("Chiudi messaggio");
  await tab("Salva voce");
  await saved();
  await tab("Aumenta Quantità");
  await expect(detail().getByLabel("Quantità", { exact: true })).toHaveText(
    "3",
  );
  await tab("Riduci Quantità");
  await expect(detail().getByLabel("Quantità", { exact: true })).toHaveText(
    "2",
  );
  await tab("Equipaggia");
  await saved();
  await expect(detail()).toContainText("Equipaggiato");
  await tab("Aggiungi oggetto");
  await fill("Nome della voce", "Astuccio di prova");
  await fill("Quantità", 0);
  await tab("Salva voce");
  await saved();
  await expect(detail().getByLabel("Quantità", { exact: true })).toHaveText(
    "0",
  );
  await assertContextNavigation(); // Return must keep the key selected, not the first item.
  await detail()
    .getByRole("button", {
      name: "Pagina Codex: Chiave del portone",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "Chiave del portone", exact: true }),
  ).toBeVisible();
  await tab("Torna alla voce del personaggio");
  await selectItem("Astuccio di prova");
  await tab("Elimina voce");
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await tab("Elimina voce");
  await tab("Conferma eliminazione");
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(
    detail().getByRole("heading", { name: "Chiave del portone", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: ".tools/m5-inventory.png", fullPage: true });
  console.log(
    "PASS inventario, quantità zero, equipaggiamento, conferma eliminazione e navigazione di provenienza con ritorno",
  );
  await tab("Capacità");
  await tab("Aggiungi incantesimo");
  await fill("Nome della voce", "Luce tenue");
  await fill("Livello o rango (testo libero)", "Primo cerchio");
  await fill("Scuola o tradizione", "Luce");
  await fill("Tempo di attivazione", "Un gesto");
  await fill("Durata", "Un breve momento");
  await fill("Portata", "Vicino");
  await fill("Componenti", "Voce");
  await fill("Descrizione", "Un testo originale, senza regole commerciali.");
  await page.getByLabel("Conosciuta", { exact: true }).check();
  await page.getByLabel("Preparata", { exact: true }).check();
  await page
    .getByLabel("Pagina della voce nel Codex", { exact: true })
    .selectOption(spellPage.id);
  await tab("Salva voce");
  await saved();
  await page
    .getByLabel("Stato o tipo", { exact: true })
    .selectOption("prepared");
  await expect(detail()).toContainText("Conosciuta · Preparata");
  await tab("Cambia preparata");
  await expect(
    page.getByText("Nessuna voce corrisponde ai filtri.", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Stato o tipo", { exact: true }).selectOption("all");
  await tab("Aggiungi capacità");
  await fill("Nome della voce", "Passo cauto");
  await fill("Livello o rango (testo libero)", "Talento personale");
  await page.getByLabel("Preparata", { exact: true }).check();
  await tab("Salva voce");
  await saved();
  await fill("Cerca per nome", "Passo");
  await fill("Filtra per rango", "Talento");
  await expect(detail()).toContainText(
    "Non segnata come conosciuta · Preparata",
  );
  assert.deepEqual(
    await invoke("get_character", { campaignId: campaign.id }),
    characterBeforeAbilities,
    "Le capacità non devono consumare risorse automaticamente",
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
  await tab("Backup e ripristino");
  await tab("Crea backup");
  const receipt = page.getByRole("region", {
    name: "Backup creato",
    exact: true,
  });
  await expect(receipt).toBeVisible();
  await expect(receipt.getByText("Personaggi", { exact: true })).toBeVisible();
  assert((await readFile(bundleFile)).length > 0);
  await close();
  console.log(
    "PASS capacità, filtri, nessuna regola automatica, backup M5 con immagine",
  );
} else {
  const expected = JSON.parse(await readFile(expectationFile, "utf8"));
  if (phase === "restore") {
    assert.deepEqual(
      await invoke("list_campaigns"),
      [],
      "Richiesto profilo .tools/m5-restored vuoto",
    );
    await tab("Backup e ripristino");
    await tab("Seleziona backup");
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await expect(
      page.getByRole("alertdialog").getByText("Personaggi", { exact: true }),
    ).toBeVisible();
    await tab("Sostituisci archivio");
    await expect(
      page.getByRole("region", { name: "Ripristino completato", exact: true }),
    ).toBeVisible();
    assert.deepEqual(await capture(), expected.data);
    await close();
    console.log("PASS ripristino M5 su profilo vuoto con copia preventiva");
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
      `PASS ${phase}: scheda/asset/documenti/grafo identici, immagine integra, fonti e ritorno alla voce operativi`,
    );
  }
}
assert.deepEqual(errors, [], "Errori runtime WebView");
await browser.close();
