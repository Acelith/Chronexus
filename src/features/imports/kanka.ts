import { tr } from "../../i18n/store";
import { command } from "../journal/api";
import type { PageKind } from "../knowledge/api";

export interface KankaRelation {
  id: string;
  targetId: string;
  label: string;
  mirrorId: string;
}
export interface KankaEntity {
  path: string;
  sourceId: string;
  name: string;
  kind: PageKind;
  entry: string;
  original: string;
  relations: KankaRelation[];
}
export interface KankaPreview {
  version: string;
  entities: KankaEntity[];
  warnings: { name: string; reason: string }[];
}
export const kankaApi = {
  inspect: () =>
    command<KankaPreview | null>("inspect_kanka_export", {
      title: tr("Choose a Kanka JSON export ZIP"),
    }),
};

const normalized = (value: string) =>
  value.normalize("NFC").trim().toLocaleLowerCase();
const blockTags = new Set([
  "P",
  "DIV",
  "LI",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "BLOCKQUOTE",
  "TR",
  "PRE",
]);

/** Kanka entries are stored HTML. DOMParser builds an inert document: no script
 * runs and no resource is fetched; only its text is kept, one line per block. */
export function entryText(html: string): string {
  if (!html.trim()) return "";
  const parsed = new DOMParser().parseFromString(html, "text/html");
  parsed.querySelectorAll("script,style,template").forEach((n) => n.remove());
  const lines: string[] = [];
  let current = "";
  const flush = () => {
    if (current.trim()) lines.push(current.replace(/\s+/g, " ").trim());
    current = "";
  };
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) current += node.textContent ?? "";
    else if (node.nodeName === "BR") flush();
    else {
      const block = blockTags.has(node.nodeName);
      if (block) flush();
      if (node.nodeName === "LI") current = "- ";
      node.childNodes.forEach(walk);
      if (block) flush();
    }
  };
  walk(parsed.body);
  flush();
  return lines.slice(0, 5000).join("\n");
}

/** Unique page titles: a name that already exists (or repeats in the export) keeps
 * its Kanka ID as a suffix instead of merging into another page. */
export function kankaTitles(
  entities: KankaEntity[],
  existingTitles: string[],
): Map<string, string> {
  const taken = new Set(existingTitles.map(normalized));
  const counts = new Map<string, number>();
  for (const e of entities)
    counts.set(normalized(e.name), (counts.get(normalized(e.name)) ?? 0) + 1);
  const titles = new Map<string, string>();
  for (const e of entities) {
    let title = e.name.slice(0, 180);
    if (
      taken.has(normalized(title)) ||
      (counts.get(normalized(e.name)) ?? 0) > 1
    )
      title = `${title.slice(0, 165)} (Kanka ${e.sourceId})`;
    const base = title.slice(0, 190);
    let suffix = 2;
    while (taken.has(normalized(title))) title = `${base} · ${suffix++}`;
    taken.add(normalized(title));
    titles.set(e.sourceId, title);
  }
  return titles;
}

/** Relation candidates between imported entities. Kanka stores a mirrored relation
 * twice (one per side); only the first side is kept. Targets outside the export are
 * counted, never guessed. */
export function kankaRelations(entities: KankaEntity[]) {
  const known = new Set(entities.map((e) => e.sourceId));
  const seen = new Set<string>();
  const kept: { from: string; to: string; label: string }[] = [];
  let missing = 0;
  for (const e of entities)
    for (const r of e.relations) {
      if (r.id && seen.has(r.id)) continue;
      if (r.id) seen.add(r.id);
      if (r.mirrorId) {
        if (seen.has(r.mirrorId)) continue;
        seen.add(r.mirrorId);
      }
      if (!known.has(r.targetId) || r.targetId === e.sourceId) {
        missing++;
        continue;
      }
      kept.push({ from: e.sourceId, to: r.targetId, label: r.label });
    }
  return { kept, missing };
}

export function kankaWarning(reason: string): string {
  switch (reason) {
    case "relations":
      return tr("Only the first 200 relations are offered.");
    case "size":
      return tr("File exceeds 1 MB and was skipped.");
    case "json":
      return tr("Invalid JSON; file skipped.");
    case "entity":
      return tr("No entity data; file skipped.");
    default:
      return tr("Missing name or entity ID; file skipped.");
  }
}
