// Real desktop WebView + Rust + SQLite. Requires an isolated, empty debug profile.
import { chromium, expect } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
const phase = process.argv[2];
if (!["prepare", "verify"].includes(phase))
  throw Error(
    "Usa prepare o verify con il profilo isolato descritto in docs/QA.md.",
  );
const browser = await chromium.connectOverCDP("http://127.0.0.1:9223");
const page = browser
  .contexts()
  .flatMap((context) => context.pages())
  .find((page) => page.url().startsWith("http://127.0.0.1:1420"));
if (!page) throw Error("Development desktop WebView not found.");
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const invoke = (name, args) =>
  page.evaluate(
    ({ name, args }) => window.__TAURI_INTERNALS__.invoke(name, args),
    { name, args },
  );
const editor = () => page.locator('.bn-editor[contenteditable="true"]');
const saved = () =>
  expect(page.locator(".save-state")).toHaveText("Saved on the computer");
async function createMention(title) {
  await editor().click();
  await page.keyboard.type(`[[${title}`);
  await page.getByText(`Create draft «${title}»`, { exact: true }).click();
  await saved();
}
try {
  if (phase === "prepare") {
    assert.deepEqual(
      await invoke("list_campaigns"),
      [],
      "The profile must be empty; do not use personal campaigns.",
    );
    await page
      .getByRole("button", { name: "Create campaign", exact: true })
      .click();
    await page.getByLabel("Campaign name").fill("Verifica Codex M2");
    await page
      .getByRole("button", { name: "Create campaign", exact: true })
      .click();
    await page
      .getByRole("button", { name: "+ Nuova sessione", exact: true })
      .click();
    await page.getByLabel("Number", { exact: true }).fill("12");
    await page.getByLabel("Session title").fill("La testimonianza");
    await page
      .getByRole("button", { name: "Create session", exact: true })
      .click();
    await editor().click();
    await page.keyboard.insertText("Ho incontrato ");
    await page.keyboard.type("[[Varek");
    await page.getByText("Create draft «Varek»", { exact: true }).click();
    await saved();
    const [campaign] = await invoke("list_campaigns");
    const [varek] = await invoke("list_pages", { campaignId: campaign.id });
    await page.getByRole("button", { name: "Open Varek", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Varek", exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("References to this page")).toContainText(
      "Sessione 12: La testimonianza",
    );
    await page.getByRole("button", { name: "Edit page", exact: true }).click();
    await page.getByLabel("Page title").fill("Varek il grigio");
    await page.getByLabel("Type", { exact: true }).selectOption("npc");
    await page.getByLabel("Status", { exact: true }).selectOption("active");
    await page.getByLabel("Aliases (one per line, up to 20)").fill("Custode");
    await page.getByRole("button", { name: "Save page", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Varek il grigio", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", {
        name: /Ho incontrato Varek.*Apri il blocco di origine/,
      })
      .click();
    await expect(
      page.getByRole("heading", { name: "La testimonianza", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".note-sheet")).toHaveAttribute(
      "data-focused-source",
      /.+/,
    );
    const blockId = await page
      .locator(".note-sheet")
      .getAttribute("data-focused-source");
    await expect(
      page.locator(`.bn-block-outer[data-id="${blockId}"]`),
    ).toHaveCSS("outline-style", "solid");
    await page
      .getByRole("button", { name: "Open Varek il grigio", exact: true })
      .click();
    await createMention("Gilda");
    await page.getByRole("button", { name: "Open Gilda", exact: true }).click();
    await expect(page.getByLabel("References to this page")).toContainText(
      "Pagina: Varek il grigio",
    );
    await page.getByRole("button", { name: "New page", exact: true }).click();
    await page.getByLabel("Page title").fill("Nara");
    await page.getByLabel("Type", { exact: true }).selectOption("npc");
    await page.getByLabel("Aliases (one per line, up to 20)").fill("Custode");
    await page
      .getByRole("button", { name: "Create page", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Nara", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Journal", exact: true }).click();
    await editor().click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type(" [[Custode]]");
    await expect(
      page.getByText("Varek il grigio", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Nara", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Create draft «Custode»", { exact: true }),
    ).toHaveCount(0);
    await page.getByText("Nara", { exact: true }).click();
    await saved();
    // Another writer claims a name after the UI's page list was loaded.
    // The real backend rejects the duplicate; typed text must survive the failure.
    await invoke("create_page", {
      campaignId: campaign.id,
      title: "Contesa",
      kind: "note",
      status: "stub",
      aliases: [],
    });
    await editor().click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type(" [[Contesa");
    await page.getByText("Create draft «Contesa»", { exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("already");
    await expect(editor()).toContainText("[[Contesa]]");
    await saved();
    // Inject an unresolved reference via the real typed command to exercise recovery.
    const [session] = await invoke("list_sessions", {
      campaignId: campaign.id,
    });
    const missingId = randomUUID();
    const document = structuredClone(session.document);
    document.blocks.push({
      id: randomUUID(),
      type: "paragraph",
      props: {},
      children: [],
      content: [
        { type: "pageMention", props: { pageId: missingId, label: "Perduta" } },
      ],
    });
    await invoke("save_document", {
      campaignId: campaign.id,
      id: session.id,
      revision: session.revision,
      document,
    });
    await page.reload();
    await page
      .getByRole("button", {
        name: "Apri Perduta (pagina mancante)",
        exact: true,
      })
      .click();
    await page.getByLabel("Title to recover").fill("Perduta recuperata");
    await page
      .getByRole("button", { name: "Recover draft", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Perduta recuperata", exact: true }),
    ).toBeVisible();
    const pages = await invoke("list_pages", { campaignId: campaign.id });
    const sessions = await invoke("list_sessions", { campaignId: campaign.id });
    assert.equal(pages.find((p) => p.id === varek.id).title, "Varek il grigio");
    assert(pages.find((p) => p.id === varek.id).aliases.includes("Varek"));
    assert.equal(pages.find((p) => p.id === missingId).status, "stub");
    assert.equal(pages.length, 5);
    await writeFile(
      ".tools/knowledge-expectation.json",
      JSON.stringify({ campaign, pages, sessions, varekId: varek.id }),
    );
    await editor().waitFor();
    await page.screenshot({ path: ".tools/codex-m2.png", fullPage: true });
    await invoke("plugin:window|close", { label: "main" }).catch(() => {});
    assert.deepEqual(errors, []);
    console.log(
      "PASS M2 prepare: [[create]], rename, stable IDs, source/block, page-to-page links, ambiguous alias and missing-page recovery on real SQLite.",
    );
  } else {
    const expected = JSON.parse(
      await readFile(".tools/knowledge-expectation.json", "utf8"),
    );
    assert.deepEqual(await invoke("list_campaigns"), [expected.campaign]);
    assert.deepEqual(
      await invoke("list_pages", { campaignId: expected.campaign.id }),
      expected.pages,
    );
    assert.deepEqual(
      await invoke("list_sessions", { campaignId: expected.campaign.id }),
      expected.sessions,
    );
    await page
      .getByRole("button", { name: "Open Varek il grigio", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Varek il grigio", exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("References to this page")).toContainText(
      "Sessione 12: La testimonianza",
    );
    await page.screenshot({
      path: ".tools/codex-m2-reopened.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "Open Gilda", exact: true }).click();
    await expect(page.getByLabel("References to this page")).toContainText(
      "Pagina: Varek il grigio",
    );
    assert.deepEqual(errors, []);
    await invoke("plugin:window|close", { label: "main" }).catch(() => {});
    console.log(
      "PASS M2 verify: documents/UUIDs/aliases identical after restart, renamed mentions and working session/page backlinks.",
    );
  }
} finally {
  await browser.close();
}
