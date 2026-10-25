// M15a desktop acceptance on an isolated debug profile only (port 9224).
// Phases: fixture (debug-only synthetic offer), quiet (same profile, no new
// check), real (fresh profile, real public channel: 0.4.0 is current, so silence).
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
assert.equal(process.env.CHRONEXUS_HERALD_QA, "isolated");
const profile = process.env.NODEX_DEV_DATA_DIR;
assert(
  profile && path.isAbsolute(profile),
  "NODEX_DEV_DATA_DIR must be absolute",
);
const phase = process.argv[2];
assert(["fixture", "quiet", "real", "optout"].includes(phase));
const port = process.env.CHRONEXUS_QA_CDP ?? "9224";
await expect
  .poll(
    async () => {
      try {
        return (await fetch(`http://127.0.0.1:${port}/json/version`)).ok;
      } catch {
        return false;
      }
    },
    { timeout: 30000 },
  )
  .toBe(true);
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
const page = browser
  .contexts()[0]
  .pages()
  .find((p) => p.url().includes("1420"));
assert(page);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const prefs = async () => {
  try {
    return JSON.parse(
      await readFile(path.join(profile, "update-announcements.json"), "utf8"),
    );
  } catch {
    return null;
  }
};
const dialog = page.locator("dialog.herald");
const out = ".tools/m15a";
await mkdir(out, { recursive: true });
const pass = (m, d) => console.log(`PASS ${m}`, d ? JSON.stringify(d) : "");

if (phase === "fixture") {
  await expect(dialog).toBeVisible({ timeout: 20000 });
  const heading = page.getByRole("heading", {
    name: "Chronexus 0.5.0 è disponibile",
  });
  await expect(heading).toBeFocused();
  await expect(page.getByText("Collaudo sintetico M15a")).toBeVisible();
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${out}/herald.png` });
  const axe = await new AxeBuilder({ page }).include("dialog.herald").analyze();
  assert.deepEqual(
    axe.violations.map((v) => v.id),
    [],
  );
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Aggiorna" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect.poll(async () => (await prefs())?.remind?.version).toBe("0.5.0");
  pass(
    "fixture announced, focus/axe ok, Escape = remind later",
    (await prefs()).remind,
  );
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
} else if (phase === "quiet") {
  const before = await prefs();
  await page.waitForTimeout(12000);
  await expect(dialog).toHaveCount(0);
  assert.deepEqual(
    await prefs(),
    before,
    "no automatic check inside the interval",
  );
  pass("restart within interval: no check, no announcement");
} else if (phase === "real") {
  assert.equal(await prefs(), null, "real phase needs a fresh profile");
  await expect.poll(prefs, { timeout: 30000 }).not.toBeNull();
  const p = await prefs();
  assert(p.lastAutomaticCheck, "a real check ran and was recorded");
  await page.waitForTimeout(6000);
  await expect(dialog).toHaveCount(0);
  pass("real channel checked once, current version: silent", p);
  await page.getByRole("button", { name: "Impostazioni dell’app" }).click();
  const box = page.getByRole("checkbox", {
    name: /Controlla una volta all’avvio/,
  });
  await box.click();
  await expect(box).not.toBeChecked();
  await expect.poll(async () => (await prefs()).startupCheck).toBe(false);
  pass("opt-out saved from settings");
} else {
  const before = await prefs();
  assert.equal(before.startupCheck, false);
  await page.waitForTimeout(12000);
  assert.deepEqual(await prefs(), before);
  await expect(dialog).toHaveCount(0);
  pass("opt-out: no automatic request after restart");
}
assert.deepEqual(errors, []);
await writeFile(
  `${out}/report-${phase}.json`,
  JSON.stringify({ phase, prefs: await prefs() }, null, 2),
);
await browser.close();
