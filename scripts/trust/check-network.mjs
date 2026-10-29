// M33: the data-flow page must name every host the shipped code can contact, and nothing
// else. Hosts come from the webview CSP (connect-src) and from https/http literals in
// non-test Rust sources (test modules, *_tests.rs, tests.rs and comment lines are skipped).
// The documented list sits between markers in docs/TRUST.md.
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = new URL("../..", import.meta.url).pathname;
// Literals that are attribution or licence links shown to the user, never fetched.
const displayOnly = new Set(["dnd.wizards.com", "creativecommons.org"]);

async function rustFiles(directory) {
  const out = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "tests") out.push(...(await rustFiles(path)));
    } else if (
      entry.name.endsWith(".rs") &&
      !entry.name.endsWith("_tests.rs") &&
      entry.name !== "tests.rs"
    )
      out.push(path);
  }
  return out;
}

export function hostsInRust(source) {
  // Inline test modules run only under `cargo test`; `#[cfg(test)] mod x;` files are skipped
  // by name in rustFiles.
  const shipped = source.split(
    /^\s*#\[cfg\(test\)\]\s*\n\s*(?:pub(?:\(crate\))?\s+)?mod\s+\w+\s*\{/m,
  )[0];
  const hosts = new Set();
  for (const line of shipped.split("\n")) {
    if (/^\s*\/\//.test(line)) continue;
    for (const match of line.matchAll(/\bhttps?:\/\/([a-z0-9.-]+)(?::\d+)?/gi))
      hosts.add(match[1].toLowerCase());
    // Bare host names in allowlists, e.g. "release-assets.githubusercontent.com".
    for (const match of line.matchAll(
      /"((?:[a-z0-9-]+\.)+(?:com|org|net|io|co|ai|dev))"/gi,
    ))
      hosts.add(match[1].toLowerCase());
  }
  return hosts;
}

export function hostsInCsp(config) {
  const csp = JSON.parse(config).app.security.csp;
  const connect = csp
    .split(";")
    .find((part) => part.trim().startsWith("connect-src"));
  return new Set(
    [...connect.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)]
      .map((m) => m[1].toLowerCase())
      .filter((host) => !host.endsWith(".localhost")),
  );
}

export function documentedHosts(markdown) {
  const block = markdown
    .split("<!-- network-hosts:start -->")[1]
    ?.split("<!-- network-hosts:end -->")[0];
  if (!block) throw Error("docs/TRUST.md lacks the network-hosts markers");
  return new Set(
    [...block.matchAll(/^\|\s*`([a-z0-9.-]+)`/gim)].map((m) =>
      m[1].toLowerCase(),
    ),
  );
}

export async function inventory() {
  const found = new Map();
  const note = (host, where) => {
    if (displayOnly.has(host)) return;
    found.set(host, [...(found.get(host) ?? []), where]);
  };
  for (const file of await rustFiles(join(root, "src-tauri/src")))
    for (const host of hostsInRust(await readFile(file, "utf8")))
      note(host, file.slice(root.length));
  for (const host of hostsInCsp(
    await readFile(join(root, "src-tauri/tauri.conf.json"), "utf8"),
  ))
    note(host, "src-tauri/tauri.conf.json (CSP connect-src)");
  return found;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const found = await inventory();
  const documented = documentedHosts(
    await readFile(join(root, "docs/TRUST.md"), "utf8"),
  );
  const undocumented = [...found.keys()].filter((h) => !documented.has(h));
  const stale = [...documented].filter((h) => !found.has(h));
  for (const [host, where] of [...found].sort())
    console.log(
      `${documented.has(host) ? "ok " : "NEW"} ${host}  <- ${[...new Set(where)].join(", ")}`,
    );
  if (undocumented.length || stale.length) {
    if (undocumented.length)
      console.error("Not in docs/TRUST.md:", undocumented.join(", "));
    if (stale.length)
      console.error("Documented but absent from the code:", stale.join(", "));
    process.exit(1);
  }
  console.log(`Network inventory matches docs/TRUST.md (${found.size} hosts).`);
}
