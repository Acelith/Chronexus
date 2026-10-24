import { tr } from "../../i18n/store";
/** Markdown editing bridge. Page UUIDs survive renames and unchanged blocks keep provenance IDs. */
type Node = Record<string, unknown>;
function record(value: unknown): value is Node {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
const pageUrl =
  /^(?:chronexus:\/\/page\/|https:\/\/chronexus\.invalid\/page\/)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
export function markdownBlocks(blocks: unknown[]): unknown[] {
  function walk(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(walk);
    if (!record(value)) return value;
    if (value.type === "pageMention") {
      const props = value.props as { pageId: string; label: string };
      return {
        type: "link",
        href: `https://chronexus.invalid/page/${props.pageId}`,
        content: [{ type: "text", text: props.label, styles: {} }],
      };
    }
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, walk(item)]),
    );
  }
  return blocks.map(walk);
}
export function validateMarkdown(source: string) {
  for (const match of source.matchAll(/\]\(([^\s)]*)/g)) {
    const href = match[1];
    if (href.startsWith("chronexus:") && !pageUrl.test(href))
      throw Error(
        tr(
          "Collegamento Chronexus non valido: conserva l’UUID completo della pagina.",
        ),
      );
    if (href && !/^(https?:|mailto:|#|chronexus:)/i.test(href))
      throw Error(
        tr("Usa link http, https, mailto o collegamenti Chronexus validi."),
      );
  }
  if (/<\/?[a-z][^>]*>/i.test(source))
    throw Error(tr("HTML non supportato: il testo originale è conservato."));
  if (new TextEncoder().encode(source).length > 1_900_000)
    throw Error(
      tr("Markdown troppo grande. Riduci il testo prima di applicarlo."),
    );
  // These block types are not in the persisted document schema. Never silently flatten them.
  if (
    /^\s*(```|~~~|<\/?[a-z!]|\|.*\||([-*_])(?:\s*\2){2,}\s*$)/im.test(source) ||
    /!\[[^\]]*\]\(/.test(source) ||
    /^\s*\[[^\]]+\]:/m.test(source)
  )
    throw Error(
      tr(
        "Tabelle, blocchi di codice, HTML, immagini e definizioni di link non sono supportati in questi appunti. Usa l’allegato immagini per le figure. Il testo originale è conservato: correggi il Markdown o annulla.",
      ),
    );
  if (/^#{4,6}\s/m.test(source))
    throw Error(tr("Usa titoli di livello 1, 2 o 3."));
}
function signature(value: unknown): string {
  function clean(item: unknown): unknown {
    if (Array.isArray(item)) return item.map(clean);
    if (!record(item)) return item;
    return Object.fromEntries(
      Object.entries(item)
        .filter(
          ([k]) =>
            ![
              "id",
              "children",
              "textAlignment",
              "textColor",
              "backgroundColor",
              "underline",
            ].includes(k),
        )
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, clean(v)]),
    );
  }
  return JSON.stringify(clean(value));
}
export function restoreMarkdownBlocks(
  parsed: unknown[],
  previous: unknown[],
): unknown[] {
  const originals = new Map<string, Node[]>();
  function collect(blocks: unknown[]) {
    for (const block of blocks) {
      if (!record(block)) continue;
      const key = signature(block);
      if (typeof block.id === "string")
        originals.set(key, [...(originals.get(key) ?? []), block]);
      if (Array.isArray(block.children)) collect(block.children);
    }
  }
  collect(previous);
  function walk(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(walk);
    if (!record(value)) return value;
    if (value.type === "link" && typeof value.href === "string") {
      const match = value.href.match(pageUrl);
      if (match) {
        const label = (value.content as { text: string }[])
          .map((t) => t.text)
          .join("");
        if (!label.trim() || label.length > 200)
          throw Error(tr("Etichetta del collegamento alla pagina non valida."));
        return { type: "pageMention", props: { pageId: match[1], label } };
      }
      if (!/^(https?:|mailto:|#)/i.test(value.href))
        throw Error(
          tr(
            "Link non supportato. Usa https, http, mailto o un collegamento di pagina Chronexus con UUID valido.",
          ),
        );
    }
    const result: Node = Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, walk(item)]),
    );
    if (typeof result.id === "string") {
      const existing = originals.get(signature(result))?.shift();
      if (existing) return { ...existing, children: result.children };
    }
    return result;
  }
  return parsed.map(walk);
}

// The editor sanitizes custom URL schemes. A reserved .invalid hostname is used
// only during conversion, never rendered or fetched; the source keeps UUID URLs.
export function markdownForParser(source: string): string {
  return source.replace(
    /(\]\()chronexus:\/\/page\/([0-9a-f-]{36})(\))/gi,
    "$1https://chronexus.invalid/page/$2$3",
  );
}
export function markdownForSource(source: string): string {
  return source.replace(
    /(\]\()https:\/\/chronexus\.invalid\/page\/([0-9a-f-]{36})(\))/gi,
    "$1chronexus://page/$2$3",
  );
}
