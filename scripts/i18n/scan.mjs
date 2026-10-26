import ts from "typescript";
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
// Preserve published message IDs when changing the source language.
const existing = JSON.parse(
  await readFile("src/i18n/catalogs/en.json", "utf8"),
);
const stableIds = new Map(
  Object.entries(existing).map(([id, text]) => [text.trim(), id]),
);
export function human(s) {
  s = s.trim().replace(/\{\d+\}/g, "x");
  return (
    !!s &&
    /[A-Za-zÀ-ÿ]/.test(s) &&
    !/^(@|\.?\.?\/|https?:|M[0-9]|\^|\[|[0-9#]|SELECT |INSERT |UPDATE |DELETE |CREATE |PRAGMA |DROP |<svg)/.test(
      s,
    ) &&
    !/[{}<>]|\\[dws]/.test(s) &&
    !/^edge[.\[]|^node[.\[]/.test(s) &&
    !/^[a-z][A-Za-z0-9]*$/.test(s) &&
    !/^[-_a-z0-9.:/]+$/.test(s) &&
    !/^(Chronexus Text|Segoe UI|Palatino|Book Antiqua|Georg|Times|Courier)/.test(
      s,
    ) &&
    !/^([a-z]{2,3}-[A-Z]|[A-Z_0-9]+$)/.test(s)
  );
}
export function idFor(source) {
  return (
    stableIds.get(source.trim()) ??
    "m_" + createHash("sha256").update(source.trim()).digest("hex").slice(0, 12)
  );
}
/** Ordinary Rust string literals. Comments, raw strings and char literals are
 * consumed first so a quote inside them (e.g. r"\\?\" or '"') cannot
 * desynchronize pairing and hide every later message of the file. */
export function rustStrings(text) {
  const out = [];
  for (const m of text.matchAll(
    /\/\/[^\n]*|\/\*[\s\S]*?\*\/|r(#*)"[\s\S]*?"\1|'(?:\\.|[^'\\])'|"((?:[^"\\]|\\.)*)"/g,
  )) {
    if (m[2] === undefined) continue;
    try {
      out.push(JSON.parse('"' + m[2] + '"'));
    } catch {
      /* not representable as JSON: not interface text */
    }
  }
  return out;
}
export function jsxText(text) {
  const lines = text.split(/\r\n|\n|\r/);
  let last = 0;
  lines.forEach((line, i) => {
    if (/[^ \t]/.test(line)) last = i;
  });
  let out = "";
  lines.forEach((line, i) => {
    line = line.replace(/\t/g, " ");
    if (i !== 0) line = line.replace(/^ +/, "");
    if (i !== lines.length - 1) line = line.replace(/ +$/, "");
    if (line) {
      out += line;
      if (i !== last) out += " ";
    }
  });
  return out;
}
export async function files(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = dir + "/" + e.name;
    if (e.isDirectory()) out.push(...(await files(p)));
    else if (
      /\.tsx?$/.test(p) &&
      !p.includes(".test.") &&
      !p.includes("/test/") &&
      !p.includes("/i18n/catalogs/") &&
      !p.endsWith("/i18n/locales.ts") &&
      !p.endsWith("/i18n/resultCount.ts") &&
      !p.endsWith("/i18n/lexicons.ts")
    )
      out.push(p);
  }
  return out;
}
if (
  process.argv[1] &&
  import.meta.url ===
    (await import("node:url")).pathToFileURL(process.argv[1]).href
) {
  const sources = {},
    origins = {};
  function add(s, p) {
    s = s.trim();
    if (
      !s ||
      (!human(s) &&
        ![
          "Codex",
          "Party",
          "Background",
          "D&D Wiki",
          "Markdown",
          "AI",
          "OK",
          "JSON",
          "PNG",
          "JPEG",
          "WebP",
          "Gemma",
          "Ollama",
          "D&D 2014",
          "D&D 2024",
          "mentions",
        ].includes(s))
    )
      return;
    const id = idFor(s);
    sources[id] = s;
    (origins[id] ??= []).push(p);
  }
  for (const p of await files("src")) {
    const source = await readFile(p, "utf8");
    const ast = ts.createSourceFile(
      p,
      source,
      ts.ScriptTarget.Latest,
      true,
      p.endsWith("tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    function walk(n) {
      if (ts.isJsxText(n)) add(jsxText(n.text), p);
      if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n))
        add(n.text, p);
      if (ts.isTemplateExpression(n)) {
        let text = n.head.text;
        n.templateSpans.forEach(
          (span, i) => (text += `{${i}}` + span.literal.text),
        );
        add(text, p);
      }
      ts.forEachChild(n, walk);
    }
    walk(ast);
  }
  // Error catalog candidates only; never change Rust or translate arbitrary campaign data.
  // English is the source language: catalogs map these ids to other locales.
  async function rust(dir) {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const p = dir + "/" + e.name;
      if (e.isDirectory()) {
        if (!e.name.includes("tests")) await rust(p);
      } else if (e.name.endsWith(".rs") && !e.name.includes("tests")) {
        const text = await readFile(p, "utf8");
        for (const s of rustStrings(text)) {
          // Model prompts and their answer sentinels are not interface text.
          if (
            /^(You are the assistant|Translate the supplied|Non risulta dalle fonti)/.test(
              s,
            )
          )
            continue;
          if (
            /^[A-ZÀ-ÿ][a-zà-ÿ]/.test(s) &&
            s.includes(" ") &&
            !/\b(SELECT|INSERT|DELETE|UPDATE|CREATE|SELECTED_|FONTI_|\{\"|DND_QA)\b/.test(
              s,
            )
          )
            add(
              s.replace(
                /\{[^{}]*\}/g,
                (() => {
                  let i = 0;
                  return () => `{${i++}}`;
                })(),
              ),
              p,
            );
        }
      }
    }
  }
  await rust("src-tauri/src");
  await mkdir("src/i18n/catalogs", { recursive: true });
  await writeFile(
    "src/i18n/catalogs/en.json",
    JSON.stringify(
      Object.fromEntries(Object.entries(sources).sort()),
      null,
      2,
    ) + "\n",
  );
  await mkdir(".tools/m10", { recursive: true });
  await writeFile(".tools/m10/origins.json", JSON.stringify(origins, null, 2));
  console.log(Object.keys(sources).length + " candidate messages");
}
