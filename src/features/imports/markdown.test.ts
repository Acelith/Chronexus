import { describe, expect, it } from "vitest";
import { document, readPage, resolver } from "./markdown";

describe("Markdown import", () => {
  it("keeps front matter and ambiguous links inert while resolving unique aliases to IDs", () => {
    const source = readPage(
      "vault/pages/Inn.md",
      "---\ntitle: The Inn\naliases: [Tavern]\n---\nMet [[Tavern]] and [[Unknown]].",
      false,
    );
    const resolve = resolver([source]);
    const result = document(
      source.body,
      new Map([[source.path, "8b23cb0d-6ab2-4315-b88c-b4f997f3b18f"]]),
      resolve,
    );
    const content = (result.blocks[0] as { content: object[] }).content;
    expect(source.markdown).toContain("aliases:");
    expect(content).toContainEqual({
      type: "pageMention",
      props: {
        pageId: "8b23cb0d-6ab2-4315-b88c-b4f997f3b18f",
        label: "Tavern",
      },
    });
    expect(content).toContainEqual({
      type: "text",
      text: "[[Unknown]]",
      styles: {},
    });
  });
  it("does not turn shared aliases into links", () => {
    const pages = [
      readPage("pages/A.md", "alias:: Friend", true),
      readPage("pages/B.md", "alias:: Friend", true),
    ];
    expect(resolver(pages)("Friend")).toBeNull();
  });
  it("keeps a Logseq block UUID and its original property in the immutable source", () => {
    const source = readPage(
      "vault/pages/One.md",
      "- A clue\n  id:: 8b23cb0d-6ab2-4315-b88c-b4f997f3b18f",
      true,
    );
    const result = document(source.body, new Map(), resolver([source]), true);
    expect((result.blocks[0] as { id: string }).id).toBe(
      "8b23cb0d-6ab2-4315-b88c-b4f997f3b18f",
    );
    expect(source.markdown).toContain("id::");
  });
});
