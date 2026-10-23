import { Component, useEffect, useState, type ReactNode } from "react";
import {
  BlockNoteSchema,
  defaultBlockSpecs,
  type PartialBlock,
} from "@blocknote/core";
import { it as dictionary } from "@blocknote/core/locales";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import { api, type JournalDocument, type Session } from "./api";
import { Autosave, type SaveState } from "./autosave";
import { it } from "../../strings";

const schema = BlockNoteSchema.create({
  blockSpecs: {
    paragraph: defaultBlockSpecs.paragraph,
    heading: defaultBlockSpecs.heading,
    bulletListItem: defaultBlockSpecs.bulletListItem,
    numberedListItem: defaultBlockSpecs.numberedListItem,
    checkListItem: defaultBlockSpecs.checkListItem,
    quote: defaultBlockSpecs.quote,
  },
});

export type SaveGuard = { flush: () => Promise<void>; dirty: () => boolean };
interface Props {
  session: Session;
  register: (guard: SaveGuard | null) => void;
  onSaved: (session: Session) => void;
}

function NoteEditor({ session, register, onSaved }: Props) {
  if (
    session.document.version !== 1 ||
    !Array.isArray(session.document.blocks) ||
    !session.document.blocks.length
  )
    throw new Error(it.unavailable);
  const editor = useCreateBlockNote({
    schema,
    dictionary,
    initialContent: session.document.blocks as PartialBlock<
      typeof schema.blockSchema
    >[],
  });
  const [state, setState] = useState<SaveState>({ kind: "saved" });
  const [saver] = useState(
    () =>
      new Autosave<JournalDocument>(
        session.revision,
        async (document, revision) => {
          const saved = await api.save(session, revision, document);
          onSaved(saved);
          return saved.revision;
        },
        setState,
      ),
  );
  useEffect(() => {
    saver.activate();
    register({ flush: () => saver.flush(), dirty: () => saver.dirty });
    return () => {
      register(null);
      saver.dispose();
    };
  }, [register, saver]);

  const status = {
    saved: it.saved,
    dirty: it.dirty,
    saving: it.saving,
    error: it.failed,
  }[state.kind];
  return (
    <>
      <div className="save-bar">
        <span role="status" className={`save-state ${state.kind}`}>
          {status}
        </span>
        <button
          type="button"
          onClick={() => {
            void saver.flush().catch(() => {});
          }}
          disabled={state.kind === "saved" || state.kind === "saving"}
        >
          {state.kind === "error" ? it.retry : it.saveNow}
        </button>
      </div>
      {state.kind === "error" ? (
        <p className="error" role="alert">
          {state.message}
        </p>
      ) : null}
      <div className="note-sheet" aria-label={it.notes}>
        <BlockNoteView
          editor={editor}
          theme="dark"
          emojiPicker={false}
          onChange={() => saver.change({ version: 1, blocks: editor.document })}
        />
      </div>
      <p className="editor-hint">{it.editorHint}</p>
    </>
  );
}

class EditorBoundary extends Component<
  { document: JournalDocument; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <section role="alert">
        <p>{it.unavailable}</p>
        <p>{it.copyHint}</p>
        <textarea
          aria-label="Documento originale"
          readOnly
          value={JSON.stringify(this.props.document, null, 2)}
        />
      </section>
    ) : (
      this.props.children
    );
  }
}

export default function Editor(props: Props) {
  return (
    <EditorBoundary document={props.session.document}>
      <NoteEditor {...props} />
    </EditorBoundary>
  );
}
