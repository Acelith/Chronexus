import { describe, it, expect } from "vitest";
import { documentText } from "./text";
describe("print and recap plain text", () => {
  it("preserves long multilingual text and nested blocks without HTML execution", () => {
    const text = "مرحبا 日本語 <script>alert(1)</script> " + "x".repeat(300);
    expect(
      documentText({
        version: 1,
        blocks: [
          { content: [{ text }], children: [{ content: [{ text: "child" }] }] },
        ],
      }),
    ).toBe(text + "\nchild");
  });
  it("keeps mention labels and ignores executable properties", () => {
    expect(
      documentText({
        version: 1,
        blocks: [
          { content: [{ props: { label: "Renamed page", script: "bad" } }] },
        ],
      }),
    ).toBe("Renamed page");
  });
});
