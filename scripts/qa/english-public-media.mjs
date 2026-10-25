import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
assert.equal(process.env.CHRONEXUS_README_QA, "isolated");
const b = await chromium.connectOverCDP("http://127.0.0.1:9224");
const p = b.contexts()[0].pages()[0];
const campaigns = await p.evaluate(() =>
  window.__TAURI_INTERNALS__.invoke("list_campaigns"),
);
assert.equal(campaigns.length, 1);
assert.equal(campaigns[0].name, "Varek’s Tower");
await p.reload();
const cdp = await p.context().newCDPSession(p);
await cdp.send("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});
await cdp.send("Emulation.setEmulatedMedia", {
  features: [{ name: "prefers-reduced-motion", value: "reduce" }],
});
await p.getByRole("button", { name: "Journal", exact: true }).click();
await p
  .locator(".session-list button")
  .filter({ hasText: "The Cartographer’s Workshop" })
  .click();
await expect(p.getByRole("button", { name: "Bold", exact: true })).toHaveText(
  "B",
);
await p.screenshot({ path: ".tools/m20/hero.png" });
// Clearly documented UI illustration using notes from the real 0.8.0 release;
// this renderer neither checks the update channel nor installs an update.
await p.evaluate(async () => {
  const resources = performance.getEntriesByType("resource").map((x) => x.name);
  const React = await import(resources.find((x) => /\/react\.js\?/.test(x)));
  const DOM = await import(
    resources.find((x) => /\/react-dom_client\.js\?/.test(x))
  );
  const Herald = (await import("/src/features/updates/HeraldAnnouncement.tsx"))
    .default;
  const host = document.createElement("div");
  document.body.append(host);
  (DOM.default ?? DOM).createRoot(host).render(
    (React.default ?? React).createElement(Herald, {
      announcement: {
        offer: {
          id: "public-media-demo",
          version: "0.8.0",
          notes:
            "A new herald logo, guided local AI setup, periodic backups and a refreshed project guide. Your notes and characters remain yours.",
        },
        sound: false,
      },
      onUpdate: () => {},
      onLater: () => {},
      onDismiss: () => {},
      onSound: async () => {},
    }),
  );
});
await expect(p.getByRole("dialog")).toBeVisible();
await p.screenshot({ path: ".tools/m20/herald-english.png" });
await cdp.send("Emulation.clearDeviceMetricsOverride");
console.log(
  "PASS English toolbar and public screenshots; herald is a documented UI illustration",
);
await b.close();
