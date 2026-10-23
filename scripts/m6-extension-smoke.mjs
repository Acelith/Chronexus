import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
const mode = process.argv[2] ?? "prepare";
const b = await chromium.connectOverCDP("http://127.0.0.1:9223");
let p;
await expect
  .poll(
    () => {
      p = b
        .contexts()
        .flatMap((c) => c.pages())
        .find((p) => p.url().includes("1420"));
      return !!p;
    },
    { timeout: 20000 },
  )
  .toBe(true);
const ipc = (name, args = {}) =>
  p.evaluate(
    ({ name, args }) => window.__TAURI_INTERNALS__.invoke(name, args),
    { name, args },
  );
if (mode === "restore") {
  await p
    .getByRole("button", { name: "Backup e ripristino", exact: true })
    .click();
  await p
    .getByRole("button", { name: "Seleziona backup", exact: true })
    .click();
  await expect(p.getByRole("alertdialog")).toBeVisible({ timeout: 30000 });
  await p
    .getByRole("button", { name: "Sostituisci archivio", exact: true })
    .click();
  await expect(
    p.getByRole("region", { name: "Ripristino completato", exact: true }),
  ).toBeVisible({ timeout: 30000 });
}
if (mode === "prepare") {
  assert.equal((await ipc("list_campaigns")).length, 0);
  await ipc("create_campaign", { name: "Prova M6 — compagnia e biblioteca" });
  await p.reload();
  await p
    .getByRole("button", {
      name: "Prova M6 — compagnia e biblioteca",
      exact: true,
    })
    .click();
  await p.getByRole("button", { name: "Party", exact: true }).click();
  await p.getByRole("button", { name: "Aggiungi membro", exact: true }).click();
  await p.getByLabel("Nome del personaggio").fill("Varek di prova");
  await p
    .getByLabel("Giocatore (facoltativo)", { exact: true })
    .fill("Giocatore esempio");
  await p.getByLabel("Ruolo nella compagnia").fill("Cartografo");
  await p.getByRole("button", { name: "Salva membro", exact: true }).click();
  await expect(
    p.getByRole("heading", { name: "Quello che so", exact: true }),
  ).toBeVisible();
  const edit = p.locator(".bn-editor[contenteditable=true]");
  await expect(edit).toBeVisible();
  await edit.click();
  await p.keyboard.type("Varek sostiene di conoscere la torre. Da verificare.");
  await p.getByRole("button", { name: "Wiki D&D", exact: true }).click();
  await p.getByLabel("Termine nella wiki").fill("magic missile");
  await p
    .getByRole("button", { name: "Cerca nella wiki", exact: true })
    .click();
  await expect(
    p
      .locator(".wiki-results button")
      .filter({ hasText: "System Reference Document 5.1" })
      .first(),
  ).toBeVisible({ timeout: 30000 });
  await p
    .locator(".wiki-results button")
    .filter({ hasText: "System Reference Document 5.1" })
    .first()
    .click();
  await expect(
    p.getByRole("heading", { name: "Magic Missile", exact: true }),
  ).toBeVisible({ timeout: 30000 });
  await expect(p.locator(".wiki-license")).toContainText("Creative Commons");
  await p.screenshot({ path: ".tools/wiki-real-m6.png" });
  const campaignId = (await ipc("list_campaigns"))[0].id;
  const members = await ipc("list_party", { campaignId });
  assert.equal(members.length, 1);
  const page = members[0].page;
  assert(JSON.stringify(page.document).includes("Da verificare"));
  await ipc("add_image", {
    campaignId,
    target: { kind: "page", id: page.id },
    caption: "Immagine di prova locale",
    role: "portrait",
    dataBase64:
      "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGOQM3Jzi0phyKtoWrBqCwAa0AUBqodUtwAAAABJRU5ErkJggg==",
  });
  const session = await ipc("create_session", {
    campaignId,
    sequence: 1,
    title: "La torre di prova",
    playedOn: null,
  });
  await ipc("save_document", {
    campaignId,
    id: session.id,
    revision: session.revision,
    document: {
      version: 1,
      blocks: [
        {
          id: randomUUID(),
          type: "paragraph",
          props: {},
          children: [],
          content: [
            { type: "text", text: "Appunto di prova: ", styles: {} },
            {
              type: "pageMention",
              props: { pageId: page.id, label: page.title },
            },
          ],
        },
      ],
    },
  });
  await p.reload();
  await p
    .getByRole("button", {
      name: "Prova M6 — compagnia e biblioteca",
      exact: true,
    })
    .click();
  await p.getByRole("button", { name: "Party", exact: true }).click();
  await p
    .getByRole("navigation", { name: "Membri del party" })
    .getByRole("button")
    .first()
    .click();
  await expect(
    p.getByRole("button", { name: "Apri immagine: Immagine di prova locale" }),
  ).toBeVisible({ timeout: 15000 });
  await p.screenshot({ path: ".tools/party-real-m6.png" });
  await p.getByRole("button", { name: "Grafo", exact: true }).click();
  await expect(p.locator(".graph-canvas")).toBeVisible();
  await p.locator(".graph-canvas").scrollIntoViewIfNeeded();
  await p.screenshot({ path: ".tools/graph-real-m6.png" });
  const graph = await ipc("get_graph", {
    campaignId,
    query: {
      kind: null,
      edgeKind: "all",
      certainty: null,
      focusId: null,
      depth: 1,
      sessionId: null,
      search: "",
    },
  });
  assert.equal(graph.edges.length, 1);
  assert.equal(graph.edges[0].kind, "mention");
  await p
    .getByRole("button", { name: "Esporta campagna", exact: true })
    .click();
  await expect(p.getByText(/Esportazione creata:/)).toBeVisible({
    timeout: 30000,
  });
  await p
    .getByRole("button", { name: "Backup e ripristino", exact: true })
    .click();
  await p.getByRole("button", { name: "Crea backup", exact: true }).click();
  await expect(
    p.getByRole("region", { name: "Backup creato", exact: true }),
  ).toBeVisible({ timeout: 30000 });
  const images = await ipc("list_images", {
    campaignId,
    target: { kind: "page", id: page.id },
  });
  const cache = await ipc("read_wiki_cache", {
    key: "entry/spells/srd_magic-missile",
  });
  assert(cache);
  await writeFile(
    ".tools/m6-extension-expected.json",
    JSON.stringify({
      members: await ipc("list_party", { campaignId }),
      images,
      cache,
    }),
  );
} else {
  const expected = JSON.parse(
      await readFile(".tools/m6-extension-expected.json", "utf8"),
    ),
    campaignId = (await ipc("list_campaigns"))[0].id;
  const members = await ipc("list_party", { campaignId });
  assert.deepEqual(members, expected.members);
  assert.deepEqual(
    await ipc("list_images", {
      campaignId,
      target: { kind: "page", id: members[0].page.id },
    }),
    expected.images,
  );
  assert.deepEqual(
    await ipc("read_wiki_cache", { key: "entry/spells/srd_magic-missile" }),
    expected.cache,
  );
  await p
    .getByRole("button", {
      name: "Prova M6 — compagnia e biblioteca",
      exact: true,
    })
    .click();
  await p.getByRole("button", { name: "Wiki D&D", exact: true }).click();
  await p.route("https://api.open5e.com/**", (r) => r.abort());
  await p.getByLabel("Termine nella wiki").fill("magic missile");
  await p
    .getByRole("button", { name: "Cerca nella wiki", exact: true })
    .click();
  await p
    .locator(".wiki-results button")
    .filter({ hasText: "System Reference Document 5.1" })
    .first()
    .click();
  await expect(
    p.getByRole("heading", { name: "Magic Missile", exact: true }),
  ).toBeVisible();
  await p
    .getByRole("button", { name: "Aggiorna voce online", exact: true })
    .click();
  await expect(
    p.getByRole("status").filter({ hasText: "copia locale" }),
  ).toBeVisible();
}
await ipc("plugin:window|close", { label: "main" }).catch(() => {});
await b.close();
console.log(
  `PASS ${mode}: real Party, canonical notes, image, Open5e entry/attribution, graph mentions, export/backup or offline restore`,
);
