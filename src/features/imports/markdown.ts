import type { JournalDocument } from "../journal/api";

export interface SourcePage {
  path: string;
  title: string;
  aliases: string[];
  markdown: string;
  body: string;
  images: string[];
}

export function readPage(
  path: string,
  markdown: string,
  logseq: boolean,
): SourcePage {
  const base = path.split("/").at(-1)?.replace(/\.md$/i, "") ?? "";
  let title = base;
  let aliases: string[] = [];
  let body = markdown.replace(/^\uFEFF/, "");
  if (body.startsWith("---\n")) {
    const end = body.indexOf("\n---\n", 4);
    if (end >= 0 && end < 20_000) {
      const front = body.slice(4, end);
      const line = front.match(/^title:\s*(.+)$/m);
      if (line) title = line[1].trim().replace(/^['"]|['"]$/g, "");
      const aliasLine = front.match(/^(?:aliases|alias):\s*(.*)$/m);
      if (aliasLine) {
        const rest = front.slice((aliasLine.index ?? 0) + aliasLine[0].length);
        const entries =
          aliasLine[1].trim() ||
          [...rest.matchAll(/^\s+-\s+(.+)$/gm)].map((m) => m[1]).join(",");
        aliases = entries
          .replace(/^\[|\]$/g, "")
          .split(",")
          .map((x) => x.trim().replace(/^['"]|['"]$/g, ""))
          .filter(Boolean);
      }
      body = body.slice(end + 5);
    }
  }
  if (logseq) {
    const property = body.match(/^title::\s*(.+)$/m);
    if (property) title = property[1].trim();
    const alias = body.match(/^aliases?::\s*(.+)$/m);
    if (alias)
      aliases = alias[1]
        .split(",")
        .map((x) => x.trim().replace(/^\[\[|\]\]$/g, ""))
        .filter(Boolean);
  }
  const images = [
    ...body.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g),
    ...body.matchAll(/!\[\[([^\]]+)\]\]/g),
  ].map((m) => {
    try {
      return decodeURIComponent(m[1].split("#")[0]);
    } catch {
      return m[1].split("#")[0];
    }
  });
  return { path, title, aliases: aliases.slice(0, 20), markdown, body, images };
}

export function linkNames(body: string): string[] {
  return [...body.matchAll(/(?<!!)\[\[([^\]\n]+)\]\]/g)]
    .map((m) => m[1].split("|")[0].split("#")[0].trim())
    .filter(Boolean);
}

const key = (value: string) =>
  value.normalize("NFC").trim().toLocaleLowerCase();
export function resolver(pages: SourcePage[]): (name: string) => string | null {
  const matches = new Map<string, Set<string>>();
  for (const page of pages)
    for (const name of [
      page.title,
      ...page.aliases,
      page.path.replace(/\.md$/i, ""),
      page.path.split("/").slice(1).join("/").replace(/\.md$/i, ""),
    ]) {
      const normalized = key(name);
      if (!matches.has(normalized)) matches.set(normalized, new Set());
      matches.get(normalized)?.add(page.path);
    }
  return (name) => {
    const result = matches.get(key(name));
    return result?.size === 1 ? [...result][0] : null;
  };
}

export function document(
  body: string,
  ids: Map<string, string>,
  resolve: (name: string) => string | null,
  logseq = false,
): JournalDocument {
  const lines = body.split(/\r?\n/).slice(0, 5000);
  const used = new Set<string>();
  const blocks = lines
    .filter((line) => line.trim() && !/^\s*[\w-]+::/.test(line))
    .map((line) => {
      const content: object[] = [];
      let previous = 0;
      for (const match of line.matchAll(/(?<!!)\[\[([^\]\n]+)\]\]/g)) {
        if (match.index > previous)
          content.push({
            type: "text",
            text: line.slice(previous, match.index),
            styles: {},
          });
        const label = match[1].split("|").at(-1)?.trim() ?? match[1];
        const name = match[1].split("|")[0].split("#")[0].trim();
        const path = resolve(name),
          id = path ? ids.get(path) : null;
        content.push(
          id
            ? { type: "pageMention", props: { pageId: id, label } }
            : { type: "text", text: match[0], styles: {} },
        );
        previous = match.index + match[0].length;
      }
      if (previous < line.length)
        content.push({ type: "text", text: line.slice(previous), styles: {} });
      const heading = line.match(/^(#{1,3})\s+/);
      return {
        id: crypto.randomUUID() as string,
        type: heading
          ? "heading"
          : /^\s*[-*]\s/.test(line)
            ? "bulletListItem"
            : "paragraph",
        props: heading ? { level: heading[1].length } : {},
        content,
        children: [],
      };
    });
  if (logseq) {
    let block = 0;
    for (const line of lines) {
      const match = line.match(/^\s*id::\s*([a-f\d-]{36})\s*$/i);
      if (
        match &&
        block > 0 &&
        !used.has(match[1]) &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          match[1],
        )
      ) {
        blocks[block - 1].id = match[1];
        used.add(match[1]);
      } else if (line.trim() && !/^\s*[\w-]+::/.test(line)) block++;
    }
  }
  return {
    version: 1,
    ...(logseq ? { importedFrom: "logseq" as const } : {}),
    blocks: blocks.length
      ? blocks
      : [
          {
            id: crypto.randomUUID(),
            type: "paragraph",
            props: {},
            content: [],
            children: [],
          },
        ],
  };
}
