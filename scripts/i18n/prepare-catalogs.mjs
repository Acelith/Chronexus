import { createHash } from "node:crypto";
import { readFile, writeFile, readdir } from "node:fs/promises";
import OpenCC from "opencc-js";
const root = "src/i18n/catalogs",
  check = process.argv.includes("--check");
const source = JSON.parse(await readFile(`${root}/it.json`, "utf8"));
const core = JSON.parse(
  await readFile("scripts/i18n/core-labels.json", "utf8"),
);
const simplify = OpenCC.Converter({ from: "tw", to: "cn" });
for (const file of await readdir(root)) {
  if (!file.endsWith(".json") || file === "it.json") continue;
  const locale = file.slice(0, -5),
    original = JSON.parse(await readFile(`${root}/${file}`, "utf8"));
  const catalog = { ...original };
  for (const [label, text] of Object.entries(core[locale] ?? {})) {
    const id =
      "m_" +
      createHash("sha256").update(label.trim()).digest("hex").slice(0, 12);
    if (Object.hasOwn(source, id)) catalog[id] = text;
  }
  const prepared = Object.fromEntries(
    Object.entries(catalog)
      .filter(([id]) => Object.hasOwn(source, id))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, text]) => [id, locale === "zh-Hans" ? simplify(text) : text]),
  );
  const dirty =
    Object.keys(original).length !== Object.keys(prepared).length ||
    Object.entries(prepared).some(([id, text]) => original[id] !== text);
  if (check && dirty)
    throw Error(
      `${locale}: esegui pnpm i18n:normalize per applicare il lessico di base e il cinese semplificato.`,
    );
  if (!check && dirty)
    await writeFile(
      `${root}/${file}`,
      JSON.stringify(prepared, null, 2) + "\n",
    );
}
console.log(
  "Cataloghi: lessico di base, chiavi attive e cinese semplificato verificati.",
);
