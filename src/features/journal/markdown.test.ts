import { expect, test } from "vitest";
import {
  markdownBlocks,
  markdownForParser,
  markdownForSource,
  restoreMarkdownBlocks,
  validateMarkdown,
} from "./markdown";
const id = "ac7568f8-a15a-4890-a62b-d8ff09e442ae";
const original = {
  id: "evidence-1",
  type: "paragraph",
  props: {},
  content: [{ type: "pageMention", props: { pageId: id, label: "Varek" } }],
  children: [],
};
test("Markdown conserva UUID e ID di blocco anche quando il titolo della pagina cambia", () => {
  const exported = markdownBlocks([original]);
  expect(JSON.stringify(exported)).toContain(
    `https://chronexus.invalid/page/${id}`,
  );
  const parsed = structuredClone(exported) as Record<string, unknown>[];
  parsed[0].id = "generated";
  expect(restoreMarkdownBlocks(parsed, [original])).toEqual([original]);
  expect(original.content[0].type).toBe("pageMention");
});
test("blocchi duplicati non duplicano gli ID della fonte", () => {
  const parsed = [
    { ...original, id: "new-1" },
    { ...original, id: "new-2" },
  ];
  const result = restoreMarkdownBlocks(parsed, [original]) as { id: string }[];
  expect(result.map((b) => b.id)).toEqual(["evidence-1", "new-2"]);
});
test.each([
  "```js\nalert(1)\n```",
  "|Nome|Valore|\n|---|---|",
  "<script>alert(1)</script>",
  "![mappa](https://example.org/a.png)",
  "#### Titolo",
])(
  "sintassi non supportata rifiutata senza conversioni silenziose: %s",
  (source) => expect(() => validateMarkdown(source)).toThrow(),
);
test("Markdown supportato e link campagna sono accettati", () =>
  expect(() =>
    validateMarkdown(
      `# Diario\n\n- [x] **Indizio**\n\n> Fonte\n\n[Varek](chronexus://page/${id})`,
    ),
  ).not.toThrow());
test.each([
  "javascript:alert(1)",
  "file:///segreto",
  "chronexus://page/non-valido",
])("rifiuta link pericolosi o UUID non validi: %s", (href) =>
  expect(() =>
    restoreMarkdownBlocks(
      [
        {
          type: "link",
          href,
          content: [{ type: "text", text: "x", styles: {} }],
        },
      ],
      [],
    ),
  ).toThrow(),
);

test("conversione URL interna reversibile attraverso il parser che filtra gli schemi custom", () => {
  const source = `[Varek](chronexus://page/${id})`;
  const parsed = markdownForParser(source);
  expect(parsed).toContain("https://chronexus.invalid/page/");
  expect(markdownForSource(parsed)).toBe(source);
  expect(() => validateMarkdown("[x](javascript:alert(1))")).toThrow();
  expect(() => validateMarkdown("[x](chronexus://page/non-valido)")).toThrow();
});

test("conserva sottolineatura, colore e allineamento dei blocchi non modificati nel sorgente", () => {
  const previous = {
    id: "prova",
    type: "paragraph",
    props: { textAlignment: "center", textColor: "red" },
    content: [
      {
        type: "text",
        text: "Testo originale",
        styles: { underline: true, backgroundColor: "yellow" },
      },
    ],
    children: [],
  };
  const parsed = {
    id: "nuovo",
    type: "paragraph",
    props: {},
    content: [{ type: "text", text: "Testo originale", styles: {} }],
    children: [],
  };
  expect(restoreMarkdownBlocks([parsed], [previous])).toEqual([previous]);
  const changed = structuredClone(parsed);
  changed.content[0].text = "Testo cambiato";
  expect(restoreMarkdownBlocks([changed], [previous])).toEqual([changed]);
});
