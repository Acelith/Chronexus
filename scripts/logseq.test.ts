import { expect, test } from "vitest";
import { metadata, references, convert } from "./logseq.mjs";
test("Logseq converts hierarchy, formatting, links, checklists and images without executing source text", () => {
  const raw =
    "type:: npc\nalias:: [[Keeper]], Ancient Varek\n- ## Title\n  - **Varek** mentions [[Guild]]\n    id:: 11111111-1111-4111-8111-111111111111\n  - TODO Check\n- ![Face](../assets/face.png){:width 100}\n- <script>alert('test')</script>";
  expect(metadata(raw, "Varek")).toMatchObject({
    title: "Varek",
    kind: "npc",
    aliases: ["Keeper", "Ancient Varek"],
  });
  expect(references(raw)).toContain("Guild");
  const result = convert(raw, (name: string) =>
    name === "Guild" ? "page-guild" : null,
  );
  expect(result.document.importedFrom).toBe("logseq");
  const heading = result.document.blocks.find(
    (b: { type: string }) => b.type === "heading",
  );
  expect(heading?.children[0].id).toBe("11111111-1111-4111-8111-111111111111");
  expect(JSON.stringify(result.document)).toContain('"pageId":"page-guild"');
  expect(JSON.stringify(result.document)).toContain("<script>");
  expect(result.imageRefs).toEqual([
    { caption: "Face", url: "../assets/face.png" },
  ]);
});
test("unresolved mentions remain literal; empty notes remain valid; excessive nesting is bounded", () => {
  const result = convert("- [[Unresolved]]");
  expect(result.document.blocks[0].content[0].text).toBe("[[Unresolved]]");
  expect(convert("").document.blocks).toHaveLength(1);
  const deep = convert(
    Array.from({ length: 20 }, (_, i) => "  ".repeat(i) + "- Riga").join("\n"),
  );
  expect(deep.warnings.length).toBeGreaterThan(0);
});
