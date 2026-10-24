import OpenCC from "opencc-js";
import { readFile, writeFile } from "node:fs/promises";
const file = "src/i18n/catalogs/zh-Hans.json";
const converter = OpenCC.Converter({ from: "tw", to: "cn" });
const source = JSON.parse(await readFile(file, "utf8"));
const normalized = Object.fromEntries(
  Object.entries(source).map(([id, text]) => [id, converter(text)]),
);
if (process.argv.includes("--check")) {
  if (JSON.stringify(source) !== JSON.stringify(normalized))
    throw Error(
      "Il catalogo zh-Hans contiene forme da normalizzare: esegui pnpm i18n:normalize.",
    );
} else await writeFile(file, JSON.stringify(normalized, null, 2) + "\n");
console.log(
  "Cinese semplificato: " +
    Object.keys(source).length +
    " messaggi verificati.",
);
