// Connects only to an explicitly started debug WebView with an isolated test profile.
import { chromium, expect } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

const phase = process.argv[2];
if (!["prepare", "verify"].includes(phase))
  throw Error("Usa prepare oppure verify; consulta docs/QA.md.");
const browser = await chromium.connectOverCDP("http://127.0.0.1:9223");
const page = browser
  .contexts()
  .flatMap((context) => context.pages())
  .find((page) => page.url().startsWith("http://127.0.0.1:1420"));
if (!page) throw Error("WebView desktop di sviluppo non trovata.");
page.on("pageerror", (error) => console.error("WebView:", error.message));
const invoke = (name, args) =>
  page.evaluate(
    ({ name, args }) => window.__TAURI_INTERNALS__.invoke(name, args),
    { name, args },
  );

try {
  if (phase === "prepare") {
    assert.deepEqual(
      await invoke("list_campaigns"),
      [],
      "Il profilo deve essere vuoto. Non usare dati personali.",
    );
    await page
      .getByRole("button", { name: "Crea campagna", exact: true })
      .click();
    await page.getByLabel("Nome della campagna").fill("Verifica locale M1");
    await page
      .getByRole("button", { name: "Crea campagna", exact: true })
      .click();
    await page.getByRole("heading", { name: "Verifica locale M1" }).waitFor();
    await page.getByRole("button", { name: "Rinomina campagna" }).click();
    await page.getByLabel("Nome della campagna").fill("Diario di verifica M1");
    await page.getByRole("button", { name: "Salva nome" }).click();
    for (const [sequence, title] of [
      [12, "Il ritorno"],
      [2, "Il ponte"],
    ]) {
      await page
        .getByRole("button", { name: "+ Nuova sessione", exact: true })
        .click();
      await page.getByLabel("Numero", { exact: true }).fill(String(sequence));
      await page.getByLabel("Titolo della sessione").fill(title);
      await page
        .getByRole("button", { name: "Crea sessione", exact: true })
        .click();
      await page.locator('.bn-editor[contenteditable="true"]').waitFor();
    }
    const editor = page.locator('.bn-editor[contenteditable="true"]');
    await editor.click();
    await page.keyboard.insertText("Varek sostiene di conoscere la gilda.");
    await page.keyboard.press("Enter");
    await page.keyboard.insertText(
      "È soltanto un sospetto, non un fatto accertato.",
    );
    await expect(page.getByRole("status")).toHaveText("Salvato sul computer");
    const [campaign] = await invoke("list_campaigns");
    const sessions = await invoke("list_sessions", { campaignId: campaign.id });
    assert.deepEqual(
      sessions.map((item) => item.sequence),
      [2, 12],
    );
    assert.equal(sessions[0].document.blocks.length, 2);
    assert.equal(
      sessions[0].document.blocks[0].content[0].text,
      "Varek sostiene di conoscere la gilda.",
    );
    assert.equal(
      sessions[0].document.blocks[1].content[0].text,
      "È soltanto un sospetto, non un fatto accertato.",
    );
    await writeFile(
      ".tools/smoke-expectation.json",
      JSON.stringify({ campaign, sessions }),
    );
    await page.screenshot({ path: ".tools/desktop-m1.png", fullPage: true });
    // Queue an edit and close immediately: the window must flush its pending write.
    await page.keyboard.insertText(" Chiusura immediata.");
    await invoke("plugin:window|close", { label: "main" }).catch(() => {});
    console.log(
      "PASS prepare: creazione/rinomina, ordine, editor reale, due paragrafi e richiesta di chiusura.",
    );
  } else {
    const expected = JSON.parse(
      await readFile(".tools/smoke-expectation.json", "utf8"),
    );
    const campaigns = await invoke("list_campaigns");
    assert.deepEqual(campaigns, [expected.campaign]);
    const sessions = await invoke("list_sessions", {
      campaignId: expected.campaign.id,
    });
    assert.deepEqual(
      sessions.map((item) => item.sequence),
      [2, 12],
    );
    const blocks = structuredClone(expected.sessions[0].document.blocks);
    blocks[1].content[0].text += " Chiusura immediata.";
    assert.deepEqual(sessions[0].document, { version: 1, blocks });
    await expect(page.locator(".bn-editor")).toContainText(
      "Varek sostiene di conoscere la gilda.",
    );
    await expect(page.locator(".bn-editor")).toContainText(
      "È soltanto un sospetto, non un fatto accertato. Chiusura immediata.",
    );
    await page.screenshot({
      path: ".tools/desktop-m1-reopened.png",
      fullPage: true,
    });
    console.log(
      "PASS verify: riavvio desktop, documento identico e ultima battuta salvata durante la chiusura.",
    );
    await page.getByRole("button", { name: /Sessione 12/ }).click();
    const editor = page.locator('.bn-editor[contenteditable="true"]');
    await editor.click();
    if (sessions[1].document.blocks.every((block) => !block.content.length)) {
      await page.keyboard.press("Control+b");
      await page.keyboard.insertText("Un indizio");
      await page.keyboard.press("Control+b");
      await page.keyboard.press("Enter");
      await page.keyboard.type("# ");
      await page.keyboard.insertText("Ipotesi");
      await page.keyboard.press("Enter");
      await page.keyboard.type("- ");
      await page.keyboard.insertText("Da verificare");
      await expect(page.getByRole("status")).toHaveText("Salvato sul computer");
    }
    const formatted = (
      await invoke("list_sessions", { campaignId: expected.campaign.id })
    )[1].document.blocks;
    assert.equal(formatted[0].content[0].styles.bold, true);
    assert.equal(formatted[1].type, "heading");
    assert.equal(formatted[2].type, "bulletListItem");
    console.log(
      "PASS formatting: grassetto, titolo ed elenco salvati in SQLite.",
    );
  }
} finally {
  await browser.close();
}
