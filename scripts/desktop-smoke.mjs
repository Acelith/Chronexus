// Connects only to an explicitly started debug WebView with an isolated test profile.
import { chromium, expect } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

const phase = process.argv[2];
if (!["prepare", "verify"].includes(phase))
  throw Error("Use prepare or verify; see docs/QA.md.");
const browser = await chromium.connectOverCDP("http://127.0.0.1:9223");
const page = browser
  .contexts()
  .flatMap((context) => context.pages())
  .find((page) => page.url().startsWith("http://127.0.0.1:1420"));
if (!page) throw Error("Development desktop WebView not found.");
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
      "The profile must be empty. Do not use personal data.",
    );
    await page
      .getByRole("button", { name: "Create campaign", exact: true })
      .click();
    await page.getByLabel("Campaign name").fill("Verifica locale M1");
    await page
      .getByRole("button", { name: "Create campaign", exact: true })
      .click();
    await page.getByRole("heading", { name: "Verifica locale M1" }).waitFor();
    await page.getByRole("button", { name: "Rename campaign" }).click();
    await page.getByLabel("Campaign name").fill("M1 verification journal");
    await page.getByRole("button", { name: "Save name" }).click();
    for (const [sequence, title] of [
      [12, "The return"],
      [2, "The bridge"],
    ]) {
      await page
        .getByRole("button", { name: "New session", exact: true })
        .click();
      await page.getByLabel("Number", { exact: true }).fill(String(sequence));
      await page.getByLabel("Session title").fill(title);
      await page
        .getByRole("button", { name: "Create session", exact: true })
        .click();
      await page.locator('.bn-editor[contenteditable="true"]').waitFor();
    }
    const editor = page.locator('.bn-editor[contenteditable="true"]');
    await editor.click();
    await page.keyboard.insertText("Varek claims to know the guild.");
    await page.keyboard.press("Enter");
    await page.keyboard.insertText(
      "It is only a suspicion, not an established fact.",
    );
    await expect(page.getByRole("status")).toHaveText("Saved on the computer");
    const [campaign] = await invoke("list_campaigns");
    const sessions = await invoke("list_sessions", { campaignId: campaign.id });
    assert.deepEqual(
      sessions.map((item) => item.sequence),
      [2, 12],
    );
    assert.equal(sessions[0].document.blocks.length, 2);
    assert.equal(
      sessions[0].document.blocks[0].content[0].text,
      "Varek claims to know the guild.",
    );
    assert.equal(
      sessions[0].document.blocks[1].content[0].text,
      "It is only a suspicion, not an established fact.",
    );
    await writeFile(
      ".tools/smoke-expectation.json",
      JSON.stringify({ campaign, sessions }),
    );
    await page.screenshot({ path: ".tools/desktop-m1.png", fullPage: true });
    // Queue an edit and close immediately: the window must flush its pending write.
    await page.keyboard.insertText(" Immediate close.");
    await invoke("plugin:window|close", { label: "main" }).catch(() => {});
    console.log(
      "PASS prepare: create/rename, ordering, real editor, two paragraphs and close request.",
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
    blocks[1].content[0].text += " Immediate close.";
    assert.deepEqual(sessions[0].document, { version: 1, blocks });
    await expect(page.locator(".bn-editor")).toContainText(
      "Varek claims to know the guild.",
    );
    await expect(page.locator(".bn-editor")).toContainText(
      "It is only a suspicion, not an established fact. Immediate close.",
    );
    await page.screenshot({
      path: ".tools/desktop-m1-reopened.png",
      fullPage: true,
    });
    console.log(
      "PASS verify: desktop restart, identical document and last keystroke saved while closing.",
    );
    await page.getByRole("button", { name: /Sessione 12/ }).click();
    const editor = page.locator('.bn-editor[contenteditable="true"]');
    await editor.click();
    if (sessions[1].document.blocks.every((block) => !block.content.length)) {
      await page.keyboard.press("Control+b");
      await page.keyboard.insertText("A clue");
      await page.keyboard.press("Control+b");
      await page.keyboard.press("Enter");
      await page.keyboard.type("# ");
      await page.keyboard.insertText("Hypothesis");
      await page.keyboard.press("Enter");
      await page.keyboard.type("- ");
      await page.keyboard.insertText("To be checked");
      await expect(page.getByRole("status")).toHaveText(
        "Saved on the computer",
      );
    }
    const formatted = (
      await invoke("list_sessions", { campaignId: expected.campaign.id })
    )[1].document.blocks;
    assert.equal(formatted[0].content[0].styles.bold, true);
    assert.equal(formatted[1].type, "heading");
    assert.equal(formatted[2].type, "bulletListItem");
    console.log("PASS formatting: bold, heading and list saved in SQLite.");
  }
} finally {
  await browser.close();
}
