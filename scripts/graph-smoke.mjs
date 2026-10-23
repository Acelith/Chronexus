// Real WebView2 + Tauri + SQLite. The canvas registry is read only to locate rendered hit targets.
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
const phase = process.argv[2];
if (!["prepare", "verify"].includes(phase))
  throw Error("Usa prepare o verify con un profilo di prova vuoto.");
const browser = await chromium.connectOverCDP("http://127.0.0.1:9223");
const page = browser
  .contexts()
  .flatMap((c) => c.pages())
  .find((p) => p.url().startsWith("http://127.0.0.1:1420"));
if (!page) throw Error("WebView di sviluppo non trovata.");
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const invoke = (name, args) =>
  page.evaluate(
    ({ name, args }) => window.__TAURI_INTERNALS__.invoke(name, args),
    { name, args },
  );
const query = {
  kind: null,
  edgeKind: "all",
  certainty: null,
  focusId: null,
  depth: 1,
  sessionId: null,
  search: "",
};
const canvas = () => page.locator(".graph-canvas");
async function graphReady(edges) {
  await expect(canvas()).toHaveAttribute("data-edge-count", String(edges));
  await expect
    .poll(() =>
      canvas().evaluate((el) =>
        Boolean(el._cyreg?.cy && !el._cyreg.cy.destroyed()),
      ),
    )
    .toBe(true);
}
async function openGraph(edges = 3) {
  await page.getByRole("button", { name: "Grafo", exact: true }).click();
  await graphReady(edges);
}
async function styles() {
  return canvas().evaluate((el) =>
    el._cyreg.cy.edges().map((edge) => ({
      kind: edge.data("kind"),
      source: edge.source().id(),
      target: edge.target().id(),
      line: edge.style("line-style"),
      label: edge.data("displayLabel"),
    })),
  );
}
async function clickElement(id, edge = false) {
  await canvas().scrollIntoViewIfNeeded();
  const point = await canvas().evaluate(
    (el, { id, edge }) => {
      const item = el._cyreg.cy.getElementById(id);
      return edge ? item.renderedMidpoint() : item.renderedPosition();
    },
    { id, edge },
  );
  assert(Number.isFinite(point.x) && Number.isFinite(point.y));
  const box = await canvas().boundingBox();
  await page.mouse.click(box.x + point.x, box.y + point.y);
}
async function selectAssertion() {
  const summary = page.getByText("Elenco accessibile di nodi e collegamenti", {
    exact: true,
  });
  if (!(await page.locator(".graph-accessible").getAttribute("open")))
    await summary.click();
  await page.getByRole("button", { name: /Relazione: Varek/ }).click();
  await page
    .getByRole("button", { name: "Modifica relazione", exact: true })
    .waitFor();
}
async function createRelationship(varek, guild, session, block) {
  await page
    .getByRole("button", { name: "Nuova relazione", exact: true })
    .click();
  await page.getByLabel("Da pagina", { exact: true }).selectOption(varek.id);
  await page.getByLabel("A pagina", { exact: true }).selectOption(guild.id);
  await page
    .getByLabel("Etichetta della relazione", { exact: true })
    .fill("accusa");
  await page.getByLabel("Certezza", { exact: true }).selectOption("suspected");
  await page
    .getByLabel("Fonte (facoltativa)", { exact: true })
    .selectOption(`session:${session.id}`);
  await page
    .getByLabel("Blocco della fonte", { exact: true })
    .selectOption(block);
  await page
    .getByLabel("Evidenza o citazione", { exact: true })
    .fill("Varek accusa la Gilda: è una dichiarazione da verificare.");
  await page
    .getByLabel("Note sulla relazione", { exact: true })
    .fill("Nessuna alleanza dedotta dalle menzioni.");
  await page
    .getByRole("button", { name: "Salva relazione", exact: true })
    .click();
  await graphReady(3);
}
try {
  if (phase === "prepare") {
    assert.deepEqual(
      await invoke("list_campaigns"),
      [],
      "Il profilo deve essere vuoto: non usare campagne personali.",
    );
    await page
      .getByRole("button", { name: "Crea campagna", exact: true })
      .click();
    await page.getByLabel("Nome della campagna").fill("Verifica grafo M3");
    await page
      .getByRole("button", { name: "Crea campagna", exact: true })
      .click();
    await page
      .getByRole("button", { name: "+ Nuova sessione", exact: true })
      .click();
    await page.getByLabel("Numero", { exact: true }).fill("12");
    await page.getByLabel("Titolo della sessione").fill("La voce di Varek");
    await page
      .getByRole("button", { name: "Crea sessione", exact: true })
      .click();
    const editor = page.locator('.bn-editor[contenteditable="true"]');
    await editor.click();
    await page.keyboard.insertText("Nella stessa nota: ");
    for (const title of ["Varek", "Gilda"]) {
      await page.keyboard.type(`[[${title}`);
      await page.getByText(`Crea bozza «${title}»`, { exact: true }).click();
      await expect(page.locator(".save-state")).toHaveText(
        "Salvato sul computer",
      );
      await editor.click();
      await page.keyboard.press("Control+End");
    }
    const [campaign] = await invoke("list_campaigns");
    const pages = await invoke("list_pages", { campaignId: campaign.id });
    const varek = pages.find((p) => p.title === "Varek"),
      guild = pages.find((p) => p.title === "Gilda");
    const [session] = await invoke("list_sessions", {
      campaignId: campaign.id,
    });
    const block = session.document.blocks[0].id;
    const before = await invoke("get_graph", {
      campaignId: campaign.id,
      query,
    });
    assert.equal(before.edges.length, 2);
    assert(
      before.edges.every(
        (e) => e.kind === "mention" && e.source === `session:${session.id}`,
      ),
    );
    await openGraph(2);
    assert((await styles()).every((e) => e.line === "dashed"));
    // A form is guarded before closing or navigating away.
    await page
      .getByRole("button", { name: "Nuova relazione", exact: true })
      .click();
    await page.getByLabel("Etichetta della relazione").fill("Da conservare");
    await page.getByRole("button", { name: "Diario", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Salva o annulla");
    await expect(page.getByLabel("Etichetta della relazione")).toHaveValue(
      "Da conservare",
    );
    await page
      .getByRole("button", { name: "Chiudi messaggio", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Annulla relazione", exact: true })
      .click();
    await createRelationship(varek, guild, session, block);
    const graph = await invoke("get_graph", { campaignId: campaign.id, query });
    let relationship = await invoke("get_relationship", {
      campaignId: campaign.id,
      id: graph.edges.find((e) => e.kind === "assertion").relationshipId,
    });
    const rendered = await styles();
    assert.equal(rendered.filter((e) => e.line === "dashed").length, 2);
    assert(
      rendered.some(
        (e) =>
          e.kind === "assertion" &&
          e.line === "solid" &&
          e.label === "accusa (Sospetta)",
      ),
    );
    await clickElement(`page:${varek.id}`);
    await expect(
      page.getByRole("heading", { name: "Varek", exact: true }),
    ).toBeVisible();
    await openGraph();
    await clickElement(`relationship:${relationship.id}`, true);
    await expect(page.getByLabel("Dettaglio collegamento")).toContainText(
      "Relazione dichiarata",
    );
    await expect(page.getByLabel("Dettaglio collegamento")).toContainText(
      "Sospetta",
    );
    await page.getByRole("button", { name: "Apri fonte", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "La voce di Varek", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".note-sheet")).toHaveAttribute(
      "data-focused-source",
      block,
    );
    await openGraph();
    await selectAssertion();
    await page
      .getByRole("button", { name: "Modifica relazione", exact: true })
      .click();
    await page
      .getByLabel("Certezza", { exact: true })
      .selectOption("disproven");
    await page
      .getByRole("button", { name: "Salva relazione", exact: true })
      .click();
    await expect(page.locator(".graph-detail .certainty")).toHaveText(
      "Smentita",
    );
    await page
      .getByLabel("Collegamenti", { exact: true })
      .selectOption("assertions");
    await page
      .getByLabel("Certezza delle relazioni", { exact: true })
      .selectOption("suspected");
    await page
      .getByRole("button", { name: "Applica filtri", exact: true })
      .click();
    await graphReady(0);
    await page
      .getByLabel("Certezza delle relazioni", { exact: true })
      .selectOption("disproven");
    await page
      .getByRole("button", { name: "Applica filtri", exact: true })
      .click();
    await graphReady(1);
    await page
      .getByRole("button", { name: "Azzera filtri", exact: true })
      .click();
    await graphReady(3);
    await page
      .getByLabel("Fonte sessione", { exact: true })
      .selectOption(session.id);
    await page
      .getByLabel("Nodo centrale", { exact: true })
      .selectOption(`page:${varek.id}`);
    await page.getByLabel("Profondità", { exact: true }).selectOption("2");
    await page
      .getByRole("button", { name: "Applica filtri", exact: true })
      .click();
    await graphReady(3);
    await page
      .getByRole("button", { name: "Azzera filtri", exact: true })
      .click();
    await graphReady(3);
    await selectAssertion();
    await page
      .getByRole("button", { name: "Elimina relazione", exact: true })
      .click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.keyboard.press("Escape");
    assert.equal(
      (await invoke("get_graph", { campaignId: campaign.id, query })).edges
        .length,
      3,
    );
    await page
      .getByRole("button", { name: "Elimina relazione", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Conferma eliminazione", exact: true })
      .click();
    await graphReady(2);
    assert(
      (
        await invoke("get_graph", { campaignId: campaign.id, query })
      ).edges.every((e) => e.kind === "mention"),
    );
    await createRelationship(varek, guild, session, block);
    const final = await invoke("get_graph", { campaignId: campaign.id, query });
    relationship = await invoke("get_relationship", {
      campaignId: campaign.id,
      id: final.edges.find((e) => e.kind === "assertion").relationshipId,
    });
    await page.screenshot({ path: ".tools/graph-m3.png", fullPage: true });
    await writeFile(
      ".tools/graph-expectation.json",
      JSON.stringify({ campaign, graph: final, relationship, session }),
    );
    assert.deepEqual(errors, []);
    await invoke("plugin:window|close", { label: "main" }).catch(() => {});
    console.log(
      "PASS M3 prepare: co-menzioni distinte, canvas/nodi/archi reali, fonte al blocco, CRUD confermato, filtri e form protetto.",
    );
  } else {
    const expected = JSON.parse(
      await readFile(".tools/graph-expectation.json", "utf8"),
    );
    assert.deepEqual(
      await invoke("get_graph", { campaignId: expected.campaign.id, query }),
      expected.graph,
    );
    assert.deepEqual(
      await invoke("get_relationship", {
        campaignId: expected.campaign.id,
        id: expected.relationship.id,
      }),
      expected.relationship,
    );
    const [session] = await invoke("list_sessions", {
      campaignId: expected.campaign.id,
    });
    assert.deepEqual(session.document, expected.session.document);
    await openGraph();
    await selectAssertion();
    await expect(page.locator(".graph-detail .certainty")).toHaveText(
      "Sospetta",
    );
    await expect(page.getByLabel("Dettaglio collegamento")).toContainText(
      "dichiarazione da verificare",
    );
    assert(
      (await styles()).some(
        (e) => e.line === "solid" && e.label === "accusa (Sospetta)",
      ),
    );
    await page.screenshot({
      path: ".tools/graph-m3-reopened.png",
      fullPage: true,
    });
    assert.deepEqual(errors, []);
    await invoke("plugin:window|close", { label: "main" }).catch(() => {});
    console.log(
      "PASS M3 verify: grafo, ID, relazione, certezza, evidenza e documento identici dopo riavvio desktop.",
    );
  }
} finally {
  await browser.close();
}
