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
          title="Annulla (Ctrl+Z)"
          aria-label="Annulla ultima modifica"
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
          title="Ripeti (Ctrl+Y)"
          aria-label="Ripeti ultima modifica"
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
          aria-label="Stile del paragrafo"
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
            Paragrafo / titolo
          </option>
          <option value="paragraph">Testo normale</option>
          <option value="h1">Titolo 1</option>
          <option value="h2">Titolo 2</option>
          <option value="h3">Titolo 3</option>
          <option value="quote">Citazione</option>
        </select>
        {(
          [
            ["bold", "Grassetto", "G"],
            ["italic", "Corsivo", "C"],
            ["underline", "Sottolineato", "S"],
            ["strike", "Barrato", "abc"],
            ["code", "Codice in linea", "</>"],
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
          title="Evidenzia selezione"
          aria-pressed={activeStyles.backgroundColor === "yellow"}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            editor.toggleStyles({ backgroundColor: "yellow" });
            editor.focus();
          }}
        >
          Evidenzia
        </button>
        <button
          type="button"
          disabled={blocked}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => blockType("bulletListItem")}
        >
          • Elenco
        </button>
        <button
          type="button"
          disabled={blocked}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => blockType("numberedListItem")}
        >
          1. Elenco
        </button>
        <button
          type="button"
          disabled={blocked}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => blockType("checkListItem")}
        >
          ☐ Attività
        </button>
        <select
          aria-label="Allineamento"
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
            Allineamento
          </option>
          <option value="left">Sinistra</option>
          <option value="center">Centro</option>
          <option value="right">Destra</option>
          <option value="justify">Giustificato</option>
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
          Inserisci link
        </button>
        <select
          aria-label="Collega pagina del Codex"
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
            Collega pagina…
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
              setLinkError(
                "Inserisci un indirizzo http, https o mailto valido.",
              );
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
            Testo del link
            <input
              value={label}
              disabled={blocked}
              onChange={(e) => setLabel(e.target.value)}
            />
          </label>
          <label>
            Indirizzo
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
            Inserisci collegamento
          </button>
          <button type="button" onClick={() => setLinkForm(false)}>
            Annulla
          </button>
        </form>
      ) : null}
    </>
  );
}
