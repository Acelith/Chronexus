import { tr } from "../../i18n/store";
import type { JournalDocument } from "../journal/api";
export function blockOptions(
  document: JournalDocument,
): { id: string; text: string }[] {
  const result: { id: string; text: string }[] = [];
  function visit(blocks: unknown[]) {
    for (const block of blocks) {
      if (!block || typeof block !== "object") continue;
      const value = block as Record<string, unknown>;
      if (typeof value.id === "string") {
        const content = Array.isArray(value.content) ? value.content : [];
        const text = content
          .map((inline) => {
            if (!inline || typeof inline !== "object") return "";
            const part = inline as Record<string, unknown>;
            if (typeof part.text === "string") return part.text;
            const props = part.props as Record<string, unknown> | undefined;
            return typeof props?.label === "string" ? props.label : "";
          })
          .join("");
        result.push({
          id: value.id,
          text: text.slice(0, 100) || tr("Block without text"),
        });
      }
      if (Array.isArray(value.children)) visit(value.children);
    }
  }
  visit(document.blocks);
  return result;
}
