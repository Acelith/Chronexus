// Read-only checks for explicitly localized interface messages. Campaign content
// and scanner candidates such as SQL, CSS classes and test fixtures are not UI.
import ts from "typescript";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { files } from "./scan.mjs";

export const translationLocales = [
  "it",
  "de",
  "fr",
  "es",
  "pt-BR",
  "ja",
  "ko",
  "zh-Hans",
  "ar",
];
// SI seconds and the canonical d20 dice notation are symbols, not prose.
const invariantSymbols = new Set(["s", "d"]);
export const nativeLanguages = [
  "English",
  "Italian",
  "German",
  "French",
  "Spanish",
  "PortugueseBR",
  "Japanese",
  "Korean",
  "SimpChinese",
  "Arabic",
];
export function missingInstallerLanguages(config) {
  return nativeLanguages.filter(
    (language) => !config.bundle?.windows?.nsis?.languages?.includes(language),
  );
}

export function uiMessages(source, path) {
  const ast = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    path.endsWith("tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const messages = new Set();
  const add = (node) => {
    if (
      node &&
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    ) {
      if (node.text.trim() && !invariantSymbols.has(node.text.trim()))
        messages.add(node.text.trim());
    }
  };
  const labels = (node) => {
    if (ts.isObjectLiteralExpression(node)) {
      for (const property of node.properties) {
        if (ts.isPropertyAssignment(property)) labels(property.initializer);
      }
    } else if (ts.isArrayLiteralExpression(node)) {
      node.elements.forEach(labels);
    } else add(node);
  };
  function walk(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      if (node.expression.text === "tr") add(node.arguments[0]);
      if (node.expression.text === "localizeLabels" && node.arguments[0])
        labels(node.arguments[0]);
    }
    if (
      (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) &&
      node.tagName.getText(ast) === "Text"
    ) {
      for (const attribute of node.attributes.properties) {
        if (
          ts.isJsxAttribute(attribute) &&
          attribute.name.getText(ast) === "source"
        ) {
          add(
            attribute.initializer && ts.isJsxExpression(attribute.initializer)
              ? attribute.initializer.expression
              : attribute.initializer,
          );
        }
      }
    }
    ts.forEachChild(node, walk);
  }
  walk(ast);
  return [...messages];
}

const parameters = (text) => (text.match(/\{\d+\}/g) ?? []).sort().join(",");
export function coverageMessages(messages, catalogs) {
  const reverse = new Map(
    Object.entries(catalogs.en).map(([id, text]) => [text.trim(), id]),
  );
  const unregistered = [];
  const missing = Object.fromEntries(
    translationLocales.map((locale) => [locale, []]),
  );
  const invalidParameters = [];
  for (const source of new Set(messages)) {
    const id = reverse.get(source.trim());
    if (!id) {
      unregistered.push(source);
      continue;
    }
    for (const locale of translationLocales) {
      const translated = catalogs[locale]?.[id];
      if (typeof translated !== "string" || !translated.trim()) {
        missing[locale].push({ id, source });
      } else if (parameters(translated) !== parameters(source)) {
        invalidParameters.push({ locale, id, source });
      }
    }
  }
  return { unregistered, missing, invalidParameters };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const catalogs = Object.fromEntries(
    await Promise.all(
      ["en", ...translationLocales].map(async (locale) => [
        locale,
        JSON.parse(await readFile(`src/i18n/catalogs/${locale}.json`, "utf8")),
      ]),
    ),
  );
  const origins = new Map();
  for (const path of await files("src")) {
    for (const text of uiMessages(await readFile(path, "utf8"), path)) {
      origins.set(text, [...new Set([...(origins.get(text) ?? []), path])]);
    }
  }
  const result = coverageMessages([...origins.keys()], catalogs);
  const installerMissing = missingInstallerLanguages(
    JSON.parse(await readFile("src-tauri/tauri.windows.conf.json", "utf8")),
  );
  const catalogMissing = Object.fromEntries(
    translationLocales.map((locale) => [
      locale,
      Object.keys(catalogs.en).filter((id) => !catalogs[locale]?.[id]?.trim())
        .length,
    ]),
  );
  if (process.argv.includes("--json")) {
    console.log(
      JSON.stringify(
        {
          uiMessages: origins.size,
          ...result,
          catalogMissing,
          installerMissing,
          origins: Object.fromEntries(origins),
        },
        null,
        2,
      ),
    );
  } else {
    console.log(
      `Localization coverage: ${origins.size} explicit UI messages; read-only.`,
    );
    console.log(
      `Unregistered UI sources: ${result.unregistered.length}; parameter mismatches: ${result.invalidParameters.length}.`,
    );
    for (const locale of translationLocales) {
      console.log(
        `${locale}: ${result.missing[locale].length} missing UI translations; ${catalogMissing[locale]} missing entries in the full candidate catalog.`,
      );
    }
    for (const source of result.unregistered)
      console.error(
        `Unregistered: ${JSON.stringify(source)} (${origins.get(source).join(", ")})`,
      );
    console.log(
      `Installer languages missing: ${installerMissing.join(", ") || "none"}.`,
    );
  }
  if (
    result.unregistered.length ||
    result.invalidParameters.length ||
    Object.values(result.missing).some((entries) => entries.length) ||
    installerMissing.length
  )
    process.exitCode = 1;
}
