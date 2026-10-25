import { createHash } from "node:crypto";
import { readFile, writeFile, readdir } from "node:fs/promises";
import OpenCC from "opencc-js";
const root = "src/i18n/catalogs",
  check = process.argv.includes("--check");
const source = JSON.parse(await readFile(`${root}/en.json`, "utf8"));
const legacy = JSON.parse(await readFile(`${root}/it.json`, "utf8"));
const ids = new Map(
  [...Object.entries(legacy), ...Object.entries(source)].map(([id, text]) => [
    text,
    id,
  ]),
);
const core = JSON.parse(
  await readFile("scripts/i18n/core-labels.json", "utf8"),
);
const simplify = OpenCC.Converter({ from: "tw", to: "cn" });
for (const file of await readdir(root)) {
  if (!file.endsWith(".json") || file === "en.json") continue;
  const locale = file.slice(0, -5),
    original = JSON.parse(await readFile(`${root}/${file}`, "utf8"));
  const catalog = { ...original };
  for (const [label, text] of Object.entries(core[locale] ?? {})) {
    const id =
      ids.get(label) ??
      "m_" +
        createHash("sha256").update(label.trim()).digest("hex").slice(0, 12);
    if (Object.hasOwn(source, id)) catalog[id] = text;
  }
  const prepared = Object.fromEntries(
    Object.entries(catalog)
      .filter(([id]) => locale === "it" || Object.hasOwn(source, id))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, text]) => [id, locale === "zh-Hans" ? simplify(text) : text]),
  );
  const dirty =
    Object.keys(original).length !== Object.keys(prepared).length ||
    Object.entries(prepared).some(([id, text]) => original[id] !== text);
  if (check && dirty)
    throw Error(
      `${locale}: run pnpm i18n:normalize to apply the core glossary and simplified Chinese.`,
    );
  if (!check && dirty)
    await writeFile(
      `${root}/${file}`,
      JSON.stringify(prepared, null, 2) + "\n",
    );
}
console.log(
  "Catalogs: core glossary, active keys and simplified Chinese verified.",
);
