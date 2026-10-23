import { randomUUID } from "node:crypto";
export const normalizeName = (name) =>
  name.trim().replace(/\s+/g, " ").toLocaleLowerCase("it");
export function metadata(markdown, fallback) {
  const values = {};
  for (const line of markdown.split(/\r?\n/)) {
    const m = line.match(/^([\w-]+)::\s*(.*)$/);
    if (m && !Object.hasOwn(values, m[1])) values[m[1]] = m[2].trim();
  }
  const type = values.type ?? "";
  const kind =
    type === "sessione"
      ? "event"
      : /^(npc|personaggio-giocante|creatura)/.test(type)
        ? "npc"
        : type === "luogo"
          ? "place"
          : type === "oggetto"
            ? "item"
            : type.startsWith("fazione")
              ? "faction"
              : type === "religione-lore"
                ? "lore"
                : "note";
  const aliases = (values.alias ?? values.aliases ?? "")
    .split(/,(?![^[]*\]\])/)
    .map((s) => s.trim().replace(/^\[\[|\]\]$/g, ""))
    .filter(Boolean);
  return {
    title: values.title || fallback,
    kind,
    status: "active",
    aliases,
    type,
  };
}
export function references(markdown) {
  return [...markdown.matchAll(/\[\[([^\]\n]+)\]\]/g)]
    .map((m) => m[1].trim())
    .filter(Boolean);
}
export function inline(markdown, resolve) {
  const content = [];
  let last = 0;
  function text(value) {
    let start = 0;
    const pattern = /\*\*([^*]+)\*\*|`([^`]+)`/g;
    for (const match of value.matchAll(pattern)) {
      if (match.index > start)
        content.push({
          type: "text",
          text: value.slice(start, match.index),
          styles: {},
        });
      content.push({
        type: "text",
        text: match[1] ?? match[2],
        styles: match[1] ? { bold: true } : { code: true },
      });
      start = match.index + match[0].length;
    }
    if (start < value.length)
      content.push({ type: "text", text: value.slice(start), styles: {} });
  }
  for (const match of markdown.matchAll(/\[\[([^\]\n]+)\]\]/g)) {
    text(markdown.slice(last, match.index));
    const name = match[1].trim(),
      id = resolve(name);
    if (id)
      content.push({ type: "pageMention", props: { pageId: id, label: name } });
    else text(match[0]);
    last = match.index + match[0].length;
  }
  text(markdown.slice(last));
  return content;
}
export function convert(markdown, resolve = () => null) {
  const roots = [],
    stack = [],
    imageRefs = [],
    warnings = [];
  let lastBlock = null;
  for (const original of markdown.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const line = original.replace(/^\t+/, (tabs) => "  ".repeat(tabs.length));
    const property = line.match(/^\s+id::\s*([a-fA-F0-9-]{36})\s*$/);
    if (property && lastBlock) {
      lastBlock.id = property[1];
      continue;
    }
    const match = line.match(/^(\s*)(?:[-*]\s+|\d+\.\s+)(.*)$/);
    let text = match ? match[2] : line.trim();
    if (!text && !match) continue;
    text = text.replace(
      /!\[([^\]]*)\]\(([^)\n]+)\)(?:\{[^}]*\})?/g,
      (_, caption, url) => {
        imageRefs.push({ caption, url });
        return `[Immagine allegata: ${caption || url}]`;
      },
    );
    const indent = match ? match[1].length : 0;
    if (!match && /^\s+/.test(line) && lastBlock) {
      lastBlock.content.push(
        { type: "text", text: "\n", styles: {} },
        ...inline(text, resolve),
      );
      continue;
    }
    const block = {
      id: randomUUID(),
      type: "paragraph",
      props: {},
      content: [],
      children: [],
    };
    const heading = text.match(/^(#{1,6})\s+(.*)$/);
    const checkbox = text.match(/^(?:\[([ xX])\]|(TODO|DONE))\s+(.*)$/);
    if (heading) {
      block.type = "heading";
      block.props = { level: Math.min(3, heading[1].length) };
      text = heading[2];
    } else if (checkbox) {
      block.type = "checkListItem";
      block.props = {
        checked: checkbox[1]?.toLowerCase() === "x" || checkbox[2] === "DONE",
      };
      text = checkbox[3];
    } else if (text.startsWith("> ")) {
      block.type = "quote";
      text = text.slice(2);
    } else if (match) {
      block.type = /^\s*\d+\./.test(line)
        ? "numberedListItem"
        : "bulletListItem";
    }
    block.content = inline(text, resolve);
    while (stack.length && stack.at(-1).indent >= indent) stack.pop();
    if (stack.length >= 12) {
      stack.length = 12;
      warnings.push(
        "Nidificazione superiore a 12 livelli appiattita; originale conservato.",
      );
    }
    (stack.at(-1)?.block.children ?? roots).push(block);
    stack.push({ indent, block });
    lastBlock = block;
  }
  if (!roots.length)
    roots.push({
      id: randomUUID(),
      type: "paragraph",
      props: {},
      content: [],
      children: [],
    });
  const used = new Set();
  function unique(blocks) {
    for (const block of blocks) {
      if (used.has(block.id)) {
        block.id = randomUUID();
        warnings.push("ID blocco duplicato sostituito.");
      }
      used.add(block.id);
      unique(block.children);
    }
  }
  unique(roots);
  return {
    document: { version: 1, importedFrom: "logseq", blocks: roots },
    imageRefs,
    warnings: [...new Set(warnings)],
  };
}
