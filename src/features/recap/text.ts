import type { JournalDocument } from "../journal/api";
/** Plain text only: campaign blocks are data, never HTML. */
export function documentText(document: JournalDocument): string {
  function inline(value: unknown): string {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.map(inline).join("");
    if (!value || typeof value !== "object") return "";
    const part = value as Record<string, unknown>;
    if (typeof part.text === "string") return part.text;
    const props = part.props as Record<string, unknown> | undefined;
    if (typeof props?.label === "string") return props.label;
    return inline(part.content);
  }
  function blocks(values: unknown[]): string {
    return values
      .map((value) => {
        if (!value || typeof value !== "object") return "";
        const b = value as Record<string, unknown>;
        return [
          inline(b.content),
          Array.isArray(b.children) ? blocks(b.children) : "",
        ]
          .filter(Boolean)
          .join("\n");
      })
      .join("\n");
  }
  return blocks(document.blocks);
}
