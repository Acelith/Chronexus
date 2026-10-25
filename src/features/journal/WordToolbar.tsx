import { tr } from "../../i18n/store";
import { Text } from "../../i18n/Text";
import { useState } from "react";
import { useEditorState } from "@blocknote/react";
import type { BlockNoteEditor } from "@blocknote/core";
import { schema } from "./schema";
import type { KnowledgePage } from "../knowledge/api";
export default function WordToolbar({
  editor,
  blocked,
  pages,
  insertPage,
}: {
  editor: BlockNoteEditor<
    typeof schema.blockSchema,
    typeof schema.inlineContentSchema,
    typeof schema.styleSchema
  >;
  blocked: boolean;
  pages: KnowledgePage[];
  insertPage: (page: KnowledgePage) => void;
}) {
  const activeStyles = useEditorState({
    editor,
    selector: ({ editor }) => editor.getActiveStyles(),
  });
  const [linkForm, setLinkForm] = useState(false),
    [href, setHref] = useState(""),
    [label, setLabel] = useState(""),
    [linkError, setLinkError] = useState("");
  function blockType(
    type:
      | "paragraph"
      | "heading"
      | "bulletListItem"
      | "numberedListItem"
      | "checkListItem"
      | "quote",
    level?: 1 | 2 | 3,
  ) {
    const selected = editor.getSelection()?.blocks ?? [
      editor.getTextCursorPosition().block,
    ];
    selected.forEach((block) => {
      if (type === "heading")
        editor.updateBlock(block, { type, props: { level: level ?? 1 } });
      else editor.updateBlock(block, { type });
    });
    editor.focus();
  }
  return (
    <>
      <>
        <button
          type="button"
          title={tr("Undo (Ctrl+Z)")}
          aria-label={tr("Undo last change")}
          disabled={blocked}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            editor.undo();
            editor.focus();
          }}
        >
          ↶
        </button>
        <button
          type="button"
          title={tr("Redo (Ctrl+Y)")}
          aria-label={tr("Redo last change")}
          disabled={blocked}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            editor.redo();
            editor.focus();
          }}
        >
          ↷
        </button>
        <select
          aria-label={tr("Paragraph style")}
          disabled={blocked}
          defaultValue=""
          onChange={(e) => {
            const value = e.target.value;
            if (value.startsWith("h"))
              blockType("heading", Number(value[1]) as 1 | 2 | 3);
            else blockType(value as "paragraph" | "quote");
            e.target.value = "";
          }}
        >
          <option value="" disabled>
            {tr("Paragraph / heading")}
          </option>
          <option value="paragraph">{tr("Normal text")}</option>
          <option value="h1">{tr("Heading 1")}</option>
          <option value="h2">{tr("Heading 2")}</option>
          <option value="h3">{tr("Heading 3")}</option>
          <option value="quote">{tr("Quote")}</option>
        </select>
        {(
          [
            ["bold", tr("Bold"), "B"],
            ["italic", tr("Italic"), "I"],
            ["underline", tr("Underline"), "U"],
            ["strike", tr("Strikethrough"), "abc"],
            ["code", tr("Inline code"), "</>"],
          ] as const
        ).map(([style, title, text]) => (
          <button
            type="button"
            key={style}
            title={title}
            aria-label={title}
            aria-pressed={!!activeStyles[style]}
            disabled={blocked}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              editor.toggleStyles({ [style]: true });
              editor.focus();
            }}
          >
            <span
              style={{
                fontWeight: style === "bold" ? 700 : undefined,
                fontStyle: style === "italic" ? "italic" : undefined,
                textDecoration:
                  style === "underline"
                    ? "underline"
                    : style === "strike"
                      ? "line-through"
                      : undefined,
              }}
            >
              {text}
            </span>
          </button>
        ))}
        <button
          type="button"
          disabled={blocked}
          title={tr("Highlight selection")}
          aria-pressed={activeStyles.backgroundColor === "yellow"}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            editor.toggleStyles({ backgroundColor: "yellow" });
            editor.focus();
          }}
        >
          <Text source={"Highlight"} />
        </button>
        <button
          type="button"
          disabled={blocked}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => blockType("bulletListItem")}
        >
          <Text source={"• List"} />
        </button>
        <button
          type="button"
          disabled={blocked}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => blockType("numberedListItem")}
        >
          <Text source={"1. List"} />
        </button>
        <button
          type="button"
          disabled={blocked}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => blockType("checkListItem")}
        >
          <Text source={"☐ Task"} />
        </button>
        <select
          aria-label={tr("Alignment")}
          disabled={blocked}
          defaultValue=""
          onChange={(e) => {
            const blocks = editor.getSelection()?.blocks ?? [
              editor.getTextCursorPosition().block,
            ];
            blocks.forEach((b) =>
              editor.updateBlock(b, {
                props: {
                  textAlignment: e.target.value as
                    "left" | "center" | "right" | "justify",
                },
              }),
            );
            editor.focus();
            e.target.value = "";
          }}
        >
          <option value="" disabled>
            {tr("Alignment")}
          </option>
          <option value="left">{tr("Left")}</option>
          <option value="center">{tr("Center")}</option>
          <option value="right">{tr("Right")}</option>
          <option value="justify">{tr("Justified")}</option>
        </select>
        <button
          type="button"
          disabled={blocked}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setLabel(editor.getSelectedText());
            setLinkForm((v) => !v);
          }}
        >
          <Text source={"Insert link"} />
        </button>
        <select
          aria-label={tr("Link Codex page")}
          disabled={blocked || !pages.length}
          defaultValue=""
          onChange={(e) => {
            const page = pages.find((p) => p.id === e.target.value);
            if (page) {
              insertPage(page);
              editor.focus();
            }
            e.target.value = "";
          }}
        >
          <option value="" disabled>
            {tr("Link page…")}
          </option>
          {pages.map((p) => (
            <option value={p.id} key={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      </>
      {linkError ? <p role="alert">{linkError}</p> : null}{" "}
      {linkForm ? (
        <form
          className="editor-link-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!/^(https?:\/\/|mailto:)/i.test(href)) {
              setLinkError(tr("Enter a valid http, https or mailto address."));
              return;
            }
            editor.createLink(href, label || href);
            editor.focus();
            setLinkForm(false);
            setLinkError("");
            setHref("");
          }}
        >
          <label>
            <Text source={"Link text"} />
            <input
              value={label}
              disabled={blocked}
              onChange={(e) => setLabel(e.target.value)}
            />
          </label>
          <label>
            <Text source={"Address"} />
            <input
              type="text"
              placeholder="https://…"
              value={href}
              disabled={blocked}
              onChange={(e) => setHref(e.target.value)}
              required
            />
          </label>
          <button type="submit" disabled={blocked}>
            <Text source={"Insert link"} />
          </button>
          <button type="button" onClick={() => setLinkForm(false)}>
            <Text source={"Cancel"} />
          </button>
        </form>
      ) : null}
    </>
  );
}
