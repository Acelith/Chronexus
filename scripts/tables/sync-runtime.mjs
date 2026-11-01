// Audited first-party source sharing: no remote code or runtime network fetches.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "../.."),
  source = resolve(root, "../Chronexus-Server");
const target = resolve(root, "vendor/table-runtime");
// Hash and write LF text so Git line-ending conversion cannot change the result.
const lf = (s) => s.replace(/\r\n/g, "\n");
const hash = (s) => createHash("sha256").update(lf(s)).digest("hex");
if (process.argv.includes("--check")) {
  const manifest = JSON.parse(
    await readFile(resolve(target, "manifest.json"), "utf8"),
  );
  const runtime = await readFile(resolve(target, "index.js"), "utf8");
  const types = await readFile(
    resolve(root, "src/features/tables/server-types.ts"),
    "utf8",
  );
  if (hash(runtime) !== manifest.runtime || hash(types) !== manifest.types)
    throw Error("Table runtime/contract integrity mismatch.");
  console.log("Bundled table runtime and generated contract verified.");
  process.exit(0);
}
await mkdir(target, { recursive: true });
const parts = await Promise.all(
  ["i18n.js", "combat.js", "board.js"].map((f) =>
    readFile(resolve(source, "web", f), "utf8").then(lf),
  ),
);
const code = `// Chronexus Table. Apache-2.0. First-party sources pinned in manifest.json.\n// Regenerate with node scripts/tables/sync-runtime.mjs.\nexport function createTableRuntime(locale) {\nconst window={};\nconst localStorage={getItem:key=>key==='chronexus-web-locale'?locale:globalThis.localStorage.getItem(key),setItem:(key,value)=>{if(key!=='chronexus-web-locale')globalThis.localStorage.setItem(key,value);}};\n${parts[0].replaceAll("  apply();", "")}\n${parts[1]}\n${parts[2]}\nreturn {board:window.ChronexusBoard,i18n:window.ChronexusI18n};\n}\n`;
const normalizedCode = code.replace(/[ \t]+$/gm, "");
const types = lf(await readFile(resolve(source, "api/types.ts"), "utf8"));
const manifest = {
  license: "Apache-2.0",
  source: "https://github.com/Acelith/Chronexus-Server",
  inputs: parts.map(hash),
  runtime: hash(normalizedCode),
  types: hash(types),
};
await writeFile(resolve(target, "index.js"), normalizedCode);
await writeFile(
  resolve(target, "manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
await writeFile(resolve(root, "src/features/tables/server-types.ts"), types);
