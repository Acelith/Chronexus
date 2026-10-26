import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import {
  uiMessages,
  auditMessages,
  translationLocales,
  missingInstallerLanguages,
  nativeLanguages,
} from "./audit.mjs";

test("audits real UI messages, including short labels, without treating data and CSS as translations", () => {
  const source = `const css = "language-settings sync-settings";
    const modelGuidance = "Untrusted campaign text";
    tr(modelGuidance); tr("yes"); tr("Session ");
    localizeLabels({ title: "Saved", nested: { label: "Waiting" } });
    const view = <><Text source="Ready" /><Text source={"Removed"} /><Image source="user-file.png" /></>;`;
  assert.deepEqual(uiMessages(source, "src/example.tsx"), [
    "yes",
    "Session",
    "Saved",
    "Waiting",
    "Ready",
    "Removed",
  ]);
});

test("English fallback is reported as a missing translation instead of a pass", () => {
  const catalogs = { en: { stable: "Delete {0}" } };
  for (const locale of translationLocales)
    catalogs[locale] = { stable: "Translated {0}" };
  assert.deepEqual(auditMessages(["Delete {0}"], catalogs).missing.it, []);
  delete catalogs.it.stable;
  assert.deepEqual(auditMessages(["Delete {0}"], catalogs).missing.it, [
    { id: "stable", source: "Delete {0}" },
  ]);
});

test("changed source text and missing or duplicated parameters fail the audit", () => {
  const catalogs = { en: { stable: "Saved {0}" } };
  for (const locale of translationLocales)
    catalogs[locale] = { stable: "Tradotto {0}" };
  catalogs.it.stable = "Tradotto";
  catalogs.de.stable = "Übersetzt {0} {0}";
  const result = auditMessages(["Saved {0}", "New text"], catalogs);
  assert.deepEqual(result.unregistered, ["New text"]);
  assert.deepEqual(
    result.invalidParameters.map((entry) => entry.locale),
    ["it", "de"],
  );
});

test("an Italian-only installer does not count as localized for the supported locales", () => {
  assert(
    missingInstallerLanguages({
      bundle: { windows: { nsis: { languages: ["Italian"] } } },
    }).includes("English"),
  );
  assert.deepEqual(
    missingInstallerLanguages({
      bundle: { windows: { nsis: { languages: nativeLanguages } } },
    }),
    [],
  );
});

test("the real audit command reports its exit status truthfully without rewriting catalogs", async () => {
  const paths = ["en", ...translationLocales].map(
    (locale) => `src/i18n/catalogs/${locale}.json`,
  );
  const before = await Promise.all(paths.map((path) => readFile(path, "utf8")));
  const run = spawnSync(
    process.execPath,
    ["scripts/i18n/audit.mjs", "--json"],
    { encoding: "utf8" },
  );
  assert.ifError(run.error);
  const report = JSON.parse(run.stdout);
  assert(report.uiMessages > 0);
  const failed =
    report.unregistered.length ||
    report.invalidParameters.length ||
    report.installerMissing.length ||
    Object.values(report.missing).some((entries) => entries.length);
  assert.equal(run.status, failed ? 1 : 0);
  assert.deepEqual(
    await Promise.all(paths.map((path) => readFile(path, "utf8"))),
    before,
  );
});
