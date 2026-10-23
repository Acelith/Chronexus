import { useContext } from "react";
import { createReactInlineContentSpec } from "@blocknote/react";
import { KnowledgeContext } from "./context";

export const PageMention = createReactInlineContentSpec(
  {
    type: "pageMention",
    propSchema: { pageId: { default: "" }, label: { default: "Pagina" } },
    content: "none",
  },
  {
    render: function Mention({ inlineContent }) {
      const context = useContext(KnowledgeContext);
      const { pageId, label } = inlineContent.props;
      const page = context.pages.find((page) => page.id === pageId);
      return (
        <button
          type="button"
          contentEditable={false}
          className={`page-mention ${page ? "" : "missing"}`}
          data-page-id={pageId}
          aria-label={`Apri ${page?.title ?? label}${page ? "" : " (pagina mancante)"}`}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => context.open(pageId, label)}
        >
          {`[[${page?.title ?? label}]]`}
          {page ? null : " ?"}
        </button>
      );
    },
    toExternalHTML: ({ inlineContent }) => (
      <span>{`[[${inlineContent.props.label}]]`}</span>
    ),
  },
);
