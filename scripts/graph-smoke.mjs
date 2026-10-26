// Real WebView2 + Tauri + SQLite. The canvas registry is read only to locate rendered hit targets.
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
const phase = process.argv[2];
if (!["prepare", "verify"].includes(phase))
  throw Error("Use prepare or verify with an empty test profile.");
const browser = await chromium.connectOverCDP("http://127.0.0.1:9223");
const page = browser
  .contexts()
  .flatMap((c) => c.pages())
  .find((p) => p.url().startsWith("http://127.0.0.1:1420"));
if (!page) throw Error("Development WebView not found.");
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
  await page.getByRole("button", { name: "Graph", exact: true }).click();
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
  const summary = page.getByText("Accessible list of nodes and links", {
    exact: true,
  });
  if (!(await page.locator(".graph-accessible").getAttribute("open")))
    await summary.click();
  await page.getByRole("button", { name: /Relazione: Varek/ }).click();
  await page
    .getByRole("button", { name: "Edit relationship", exact: true })
    .waitFor();
}
async function createRelationship(varek, guild, session, block) {
  await page
    .getByRole("button", { name: "New relationship", exact: true })
    .click();
  await page.getByLabel("From page", { exact: true }).selectOption(varek.id);
  await page.getByLabel("At page", { exact: true }).selectOption(guild.id);
  await page.getByLabel("Relationship label", { exact: true }).fill("accusa");
  await page.getByLabel("Certainty", { exact: true }).selectOption("suspected");
  await page
    .getByLabel("Source (optional)", { exact: true })
    .selectOption(`session:${session.id}`);
  await page.getByLabel("Source block", { exact: true }).selectOption(block);
  await page
    .getByLabel("Evidence or quote", { exact: true })
    .fill("Varek accusa la Gilda: è una dichiarazione da verificare.");
  await page
    .getByLabel("Relationship notes", { exact: true })
    .fill("Nessuna alleanza dedotta dalle menzioni.");
  await page
    .getByRole("button", { name: "Save relationship", exact: true })
    .click();
  await graphReady(3);
}
try {
  if (phase === "prepare") {
    assert.deepEqual(
      await invoke("list_campaigns"),
      [],
      "The profile must be empty: do not use personal campaigns.",
    );
    await page
      .getByRole("button", { name: "Create campaign", exact: true })
      .click();
    await page.getByLabel("Campaign name").fill("Verifica grafo M3");
    await page
      .getByRole("button", { name: "Create campaign", exact: true })
      .click();
    await page
      .getByRole("button", { name: "+ Nuova sessione", exact: true })
      .click();
    await page.getByLabel("Number", { exact: true }).fill("12");
    await page.getByLabel("Session title").fill("La voce di Varek");
    await page
      .getByRole("button", { name: "Create session", exact: true })
      .click();
    const editor = page.locator('.bn-editor[contenteditable="true"]');
    await editor.click();
    await page.keyboard.insertText("Nella stessa nota: ");
    for (const title of ["Varek", "Gilda"]) {
      await page.keyboard.type(`[[${title}`);
      await page.getByText(`Create draft «${title}»`, { exact: true }).click();
      await expect(page.locator(".save-state")).toHaveText(
        "Saved on the computer",
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
      .getByRole("button", { name: "New relationship", exact: true })
      .click();
    await page.getByLabel("Relationship label").fill("Da conservare");
    await page.getByRole("button", { name: "Journal", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Save or cancel");
    await expect(page.getByLabel("Relationship label")).toHaveValue(
      "Da conservare",
    );
    await page
      .getByRole("button", { name: "Close message", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Cancel relationship", exact: true })
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
    await expect(page.getByLabel("Link details")).toContainText(
      "Declared relationship",
    );
    await expect(page.getByLabel("Link details")).toContainText("Suspected");
    await page
      .getByRole("button", { name: "Open source", exact: true })
      .click();
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
      .getByRole("button", { name: "Edit relationship", exact: true })
      .click();
    await page
      .getByLabel("Certainty", { exact: true })
      .selectOption("disproven");
    await page
      .getByRole("button", { name: "Save relationship", exact: true })
      .click();
    await expect(page.locator(".graph-detail .certainty")).toHaveText(
      "Disproven",
    );
    await page.getByLabel("Links", { exact: true }).selectOption("assertions");
    await page
      .getByLabel("Relationship certainty", { exact: true })
      .selectOption("suspected");
    await page
      .getByRole("button", { name: "Apply filters", exact: true })
      .click();
    await graphReady(0);
    await page
      .getByLabel("Relationship certainty", { exact: true })
      .selectOption("disproven");
    await page
      .getByRole("button", { name: "Apply filters", exact: true })
      .click();
    await graphReady(1);
    await page
      .getByRole("button", { name: "Clear filters", exact: true })
      .click();
    await graphReady(3);
    await page
      .getByLabel("Session source", { exact: true })
      .selectOption(session.id);
    await page
      .getByLabel("Central node", { exact: true })
      .selectOption(`page:${varek.id}`);
    await page.getByLabel("Depth", { exact: true }).selectOption("2");
    await page
      .getByRole("button", { name: "Apply filters", exact: true })
      .click();
    await graphReady(3);
    await page
      .getByRole("button", { name: "Clear filters", exact: true })
      .click();
    await graphReady(3);
    await selectAssertion();
    await page
      .getByRole("button", { name: "Delete relationship", exact: true })
      .click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.keyboard.press("Escape");
    assert.equal(
      (await invoke("get_graph", { campaignId: campaign.id, query })).edges
        .length,
      3,
    );
    await page
      .getByRole("button", { name: "Delete relationship", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Confirm deletion", exact: true })
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
      "PASS M3 prepare: distinct co-mentions, real canvas/nodes/edges, block source, confirmed CRUD, filters and guarded form.",
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
      "Suspected",
    );
    await expect(page.getByLabel("Link details")).toContainText(
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
      "PASS M3 verify: graph, IDs, relationship, certainty, evidence and document identical after desktop restart.",
    );
  }
} finally {
  await browser.close();
}
