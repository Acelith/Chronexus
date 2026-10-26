// Real Tauri/WebView2/SQLite/ZIP; no command or data mocks. Chooser steps can
// use native dialogs or the debug-only NODEX_DEV_*_FILE chooser-result override.
// Never run this against a personal profile.
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";

const phase = process.argv[2];
const targetDirectory = path.resolve(
  process.env.NODEX_SMOKE_TARGET || ".tools/m4-target",
);
assert(
  targetDirectory.startsWith(path.resolve(".tools") + path.sep),
  "Il profilo smoke deve essere dentro .tools",
);
await expect
  .poll(
    async () => {
      try {
        return (await fetch("http://127.0.0.1:9223/json/version")).ok;
      } catch {
        return false;
      }
    },
    { timeout: 20000, intervals: [100, 200, 500] },
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
    { timeout: 20000, intervals: [100, 200, 500] },
  )
  .toBe(true);
assert(page, "Development WebView not found");
const invoke = (name, args) =>
  page.evaluate(
    ({ name, args }) => window.__TAURI_INTERNALS__.invoke(name, args),
    { name, args },
  );
const expectationPath = ".tools/backup-expectation.json";
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const query = {
  kind: null,
  edgeKind: "all",
  certainty: null,
  focusId: null,
  depth: 1,
  sessionId: null,
  search: "",
};
async function data() {
  const campaigns = await invoke("list_campaigns");
  return Promise.all(
    campaigns.map(async (campaign) => ({
      campaign,
      sessions: await invoke("list_sessions", { campaignId: campaign.id }),
      pages: await invoke("list_pages", { campaignId: campaign.id }),
      graph: await invoke("get_graph", { campaignId: campaign.id, query }),
    })),
  );
}
async function openBackup() {
  await page
    .getByRole("button", { name: "Backup and restore", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Backup and restore", exact: true }),
  ).toBeVisible();
}
async function close() {
  await invoke("plugin:window|close", { label: "main" }).catch((reason) => {
    if (!/closed/.test(String(reason))) throw reason;
  });
}
if (phase === "seed") {
  assert.deepEqual(
    await invoke("list_campaigns"),
    [],
    "Richiesto profilo M4 sorgente vuoto",
  );
  const campaign = await invoke("create_campaign", {
    name: "Verifica backup M4",
  });
  await invoke("create_campaign", { name: "Seconda campagna M4" });
  const v = await invoke("create_page", {
    campaignId: campaign.id,
    title: "Varek",
    kind: "npc",
    status: "active",
    aliases: ["Il testimone"],
  });
  const g = await invoke("create_page", {
    campaignId: campaign.id,
    title: "Gilda",
    kind: "faction",
    status: "stub",
    aliases: [],
  });
  const s = await invoke("create_session", {
    campaignId: campaign.id,
    sequence: 12,
    title: "Una dichiarazione",
    playedOn: "2026-10-23",
  });
  const document = {
    version: 1,
    blocks: [
      {
        id: "m4-proof",
        type: "paragraph",
        props: {},
        children: [],
        content: [
          { type: "text", text: "Varek accusa la Gilda. ", styles: {} },
          ...[v, g].map((p) => ({
            type: "pageMention",
            props: { pageId: p.id, label: p.title },
          })),
        ],
      },
    ],
  };
  await invoke("save_document", {
    campaignId: campaign.id,
    id: s.id,
    revision: 0,
    document,
  });
  await invoke("save_page_document", {
    campaignId: campaign.id,
    id: v.id,
    revision: 0,
    document,
  });
  const relationship = await invoke("save_relationship", {
    campaignId: campaign.id,
    id: null,
    revision: null,
    input: {
      fromPageId: v.id,
      toPageId: g.id,
      label: "accusa",
      certainty: "suspected",
      sourceKind: "session",
      sourceId: s.id,
      sourceBlockId: "m4-proof",
      evidence: "Dichiarazione, non fatto confermato.",
      notes: "Verificare con il personaggio.",
    },
  });
  const source = path.resolve(".tools/m4-source");
  const attachment = `attachments/${campaign.id}/${randomUUID()}.png`;
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZukAAAAASUVORK5CYII=",
    "base64",
  );
  await mkdir(path.dirname(path.join(source, attachment)), { recursive: true });
  await writeFile(path.join(source, attachment), png);
  const expected = {
    data: await data(),
    relationship,
    attachment,
    attachmentHash: createHash("sha256").update(png).digest("hex"),
  };
  await writeFile(expectationPath, JSON.stringify(expected));
  await page.reload();
  await openBackup();
  console.log(
    "PASS seed: two campaigns, session, pages, mentions, sourced relationship and real image",
  );
} else if (phase === "create") {
  await page
    .getByRole("button", { name: "Create backup", exact: true })
    .click();
  console.log(
    "Selezionare nel dialogo nativo: .tools/m4-portable.nodex (percorso assoluto).",
  );
} else if (phase === "created") {
  const receipt = page.getByRole("region", {
    name: "Backup created",
    exact: true,
  });
  await expect(receipt).toBeVisible();
  await expect(receipt.getByText("Attachments", { exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText(
    "Backup created and verified.",
  );
  assert((await readFile(".tools/m4-portable.nodex")).length > 0);
  await page.screenshot({ path: ".tools/backup-created.png", fullPage: true });
  await close();
  console.log(
    "PASS backup reale creato e verificato (scelta file nativa o predefinita nel debug)",
  );
} else if (phase === "select") {
  const campaigns = await invoke("list_campaigns");
  if (!campaigns.length) {
    const prior = await invoke("create_campaign", {
      name: "Archivio da proteggere M4",
    });
    const expected = JSON.parse(await readFile(expectationPath, "utf8"));
    expected.prior = prior;
    await writeFile(expectationPath, JSON.stringify(expected));
    await page.reload();
  }
  await openBackup();
  await page
    .getByRole("button", { name: "Select backup", exact: true })
    .click();
  console.log("Selezionare nel dialogo nativo .tools/m4-portable.nodex.");
} else if (phase === "cancel") {
  const expected = JSON.parse(await readFile(expectationPath, "utf8"));
  await expect(page.getByRole("alertdialog")).toBeVisible();
  assert.deepEqual(await invoke("list_campaigns"), [expected.prior]);
  await page
    .getByRole("button", { name: "Archivio da proteggere M4", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Conferma o annulla");
  await page
    .getByRole("button", { name: "Cancel restore", exact: true })
    .focus();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  assert.deepEqual(await invoke("list_campaigns"), [expected.prior]);
  await page
    .getByRole("button", { name: "Close message", exact: true })
    .click();
  console.log(
    "PASS preview, navigation guard and cancellation without replacement",
  );
} else if (phase === "restore") {
  const expected = JSON.parse(await readFile(expectationPath, "utf8"));
  await expect(page.getByRole("alertdialog")).toBeVisible();
  assert.deepEqual(await invoke("list_campaigns"), [expected.prior]);
  await page.screenshot({ path: ".tools/backup-preview.png", fullPage: true });
  await page
    .getByRole("button", { name: "Replace archive", exact: true })
    .click();
  const receipt = page.getByRole("region", {
    name: "Restore completed",
    exact: true,
  });
  await expect(receipt).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Verifica backup M4", exact: true }),
  ).toBeVisible();
  assert.deepEqual(await data(), expected.data);
  const safetyPath = await receipt.locator(".archive-path").innerText();
  assert((await readFile(safetyPath)).length > 0);
  expected.safetyPath = safetyPath;
  await writeFile(expectationPath, JSON.stringify(expected));
  await page.screenshot({ path: ".tools/backup-restored.png", fullPage: true });
  await close();
  console.log("PASS ripristino, confronto integrale dati e copia preventiva");
} else if (phase === "verify") {
  const expected = JSON.parse(await readFile(expectationPath, "utf8"));
  assert.deepEqual(await data(), expected.data);
  assert.deepEqual(
    await invoke("get_relationship", {
      campaignId: expected.relationship.campaignId,
      id: expected.relationship.id,
    }),
    expected.relationship,
  );
  const root = targetDirectory;
  const id = JSON.parse(
    await readFile(path.join(root, "active-profile.json"), "utf8"),
  );
  const image = await readFile(
    path.join(root, "profiles", id, expected.attachment),
  );
  assert.equal(
    createHash("sha256").update(image).digest("hex"),
    expected.attachmentHash,
  );
  await page
    .getByRole("button", { name: "Verifica backup M4", exact: true })
    .click();
  await page.getByRole("button", { name: "Graph", exact: true }).click();
  await expect(page.locator(".graph-canvas")).toHaveAttribute(
    "data-edge-count",
    "5",
  );
  await page.screenshot({ path: ".tools/backup-reopened.png", fullPage: true });
  await close();
  console.log(
    "PASS restart: documents, UUIDs, mentions, relationships/sources, graph and image hash identical",
  );
} else
  throw Error(
    "Invalid phase: seed/create/created/select/cancel/restore/verify",
  );
assert.deepEqual(errors, [], "Errori runtime WebView");
await browser.close();
