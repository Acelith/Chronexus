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
test("Markdown preserves UUIDs and block IDs when the page title changes", () => {
  const exported = markdownBlocks([original]);
  expect(JSON.stringify(exported)).toContain(
    `https://chronexus.invalid/page/${id}`,
  );
  const parsed = structuredClone(exported) as Record<string, unknown>[];
  parsed[0].id = "generated";
  expect(restoreMarkdownBlocks(parsed, [original])).toEqual([original]);
  expect(original.content[0].type).toBe("pageMention");
});
test("duplicated blocks do not duplicate source IDs", () => {
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
  "#### Title",
])("unsupported syntax is rejected without silent conversion: %s", (source) =>
  expect(() => validateMarkdown(source)).toThrow(),
);
test("supported Markdown and campaign links are accepted", () =>
  expect(() =>
    validateMarkdown(
      `# Journal\n\n- [x] **Clue**\n\n> Source\n\n[Varek](chronexus://page/${id})`,
    ),
  ).not.toThrow());
test.each([
  "javascript:alert(1)",
  "file:///secret",
  "chronexus://page/invalid",
])("rejects unsafe links or invalid UUIDs: %s", (href) =>
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

test("internal URL conversion survives the parser that filters custom schemes", () => {
  const source = `[Varek](chronexus://page/${id})`;
  const parsed = markdownForParser(source);
  expect(parsed).toContain("https://chronexus.invalid/page/");
  expect(markdownForSource(parsed)).toBe(source);
  expect(() => validateMarkdown("[x](javascript:alert(1))")).toThrow();
  expect(() => validateMarkdown("[x](chronexus://page/invalid)")).toThrow();
});

test("preserves underline, color and alignment of blocks unchanged in source", () => {
  const previous = {
    id: "prova",
    type: "paragraph",
    props: { textAlignment: "center", textColor: "red" },
    content: [
      {
        type: "text",
        text: "Original text",
        styles: { underline: true, backgroundColor: "yellow" },
      },
    ],
    children: [],
  };
  const parsed = {
    id: "nuovo",
    type: "paragraph",
    props: {},
    content: [{ type: "text", text: "Original text", styles: {} }],
    children: [],
  };
  expect(restoreMarkdownBlocks([parsed], [previous])).toEqual([previous]);
  const changed = structuredClone(parsed);
  changed.content[0].text = "Changed text";
  expect(restoreMarkdownBlocks([changed], [previous])).toEqual([changed]);
});
