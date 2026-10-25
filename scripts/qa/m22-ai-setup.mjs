// M22 desktop acceptance on an isolated debug profile only (CDP 9224).
// "install" really downloads the official Ollama archive (~1.6 GB) into the
// profile's ai-runtime folder, then starts, checks and stops it. "pull" checks
// a qualified model already present in the running runtime (no large download).
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
assert.equal(process.env.CHRONEXUS_AI_SETUP_QA, "isolated");
const profile = process.env.NODEX_DEV_DATA_DIR;
assert(profile && path.isAbsolute(profile));
const phase = process.argv[2];
assert(["install", "pull"].includes(phase));
const browser = await chromium.connectOverCDP("http://127.0.0.1:9224");
const page = browser
  .contexts()[0]
  .pages()
  .find((p) => p.url().includes("1420"));
assert(page);
await page.getByRole("button", { name: "App settings" }).click();
const region = page.getByRole("region", { name: "Local AI: components" });
const check = () =>
  region.getByRole("button", { name: "Check components" }).click();
const pass = (m) => console.log("PASS " + m);
await check();
await region.locator("dl.ai-setup-status").waitFor();
if (phase === "install") {
  assert(!existsSync(path.join(profile, "ai-runtime")), "fresh profile");
  await region.getByRole("button", { name: "Install Ollama…" }).click();
  await region.getByRole("button", { name: "Download and install" }).click();
  const started = Date.now();
  await expect(region.getByText(/Ollama installato e verificato/)).toBeVisible({
    timeout: 30 * 60_000,
  });
  const entries = readdirSync(path.join(profile, "ai-runtime"));
  assert.deepEqual(entries, ["ollama-0.40.10"], "no partial files left");
  pass(`install ${Math.round((Date.now() - started) / 1000)} s`);
  await region.getByRole("button", { name: "Start Ollama" }).click();
  await expect(
    region.getByText(/cloud disabilitato · versione 0.40.10/),
  ).toBeVisible({ timeout: 60_000 });
  await expect(region.getByText(/avviato da Chronexus/)).toBeVisible();
  pass("managed runtime started with cloud disabled");
  await region.getByRole("button", { name: "Stop Ollama" }).click();
  await expect(
    region.getByText(/Installato da Chronexus, non avviato/),
  ).toBeVisible({ timeout: 30_000 });
  pass("managed runtime stopped");
} else {
  await expect(region.getByText(/cloud disabilitato/)).toBeVisible();
  await region.getByRole("button", { name: "Download model…" }).click();
  await region.getByRole("button", { name: "Download", exact: true }).click();
  await expect(region.getByText(/scaricato e verificato/)).toBeVisible({
    timeout: 10 * 60_000,
  });
  await expect(region.getByText(/è pronto/)).toBeVisible();
  pass("qualified model pulled/verified through the running runtime");
}
await browser.close();
