import {
  Component,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  BlockNoteSchema,
  defaultBlockSpecs,
  defaultInlineContentSpecs,
  type PartialBlock,
} from "@blocknote/core";
import { it as dictionary } from "@blocknote/core/locales";
import {
  SuggestionMenuController,
  useCreateBlockNote,
  type DefaultReactSuggestionItem,
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import { api, type JournalDocument, type Session } from "./api";
import { Autosave, type SaveState } from "./autosave";
import { it } from "../../strings";
import { PageMention } from "../knowledge/Mention";
import { KnowledgeContext } from "../knowledge/context";
import { knowledgeApi, pageKinds, type KnowledgePage } from "../knowledge/api";
import { canCreatePage, matchingPages } from "../knowledge/links";

const schema = BlockNoteSchema.create({
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    pageMention: PageMention,
  },
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
type Props = {
  register: (guard: SaveGuard | null) => void;
  focusBlock?: string;
  disabled?: boolean;
} & (
  | { session: Session; onSaved: (session: Session) => void }
  | { page: KnowledgePage; onSaved: (page: KnowledgePage) => void }
);

function NoteEditor(props: Props) {
  const { register, focusBlock } = props;
  const session = "session" in props ? props.session : props.page;
  const links = useContext(KnowledgeContext);
  const linkingTask = useRef<Promise<void> | null>(null);
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState("");
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
          if ("session" in props) {
            const saved = await api.save(props.session, revision, document);
            props.onSaved(saved);
            return saved.revision;
          }
          const saved = await knowledgeApi.save(props.page, revision, document);
          props.onSaved(saved);
          return saved.revision;
        },
        setState,
      ),
  );
  useEffect(() => {
    saver.activate();
    register({
      flush: async () => {
        await linkingTask.current;
        await saver.flush();
      },
      dirty: () => saver.dirty || linkingTask.current !== null,
    });
    return () => {
      register(null);
      saver.dispose();
    };
  }, [register, saver]);

  useEffect(() => {
    if (!focusBlock) return;
    let node: HTMLElement | undefined;
    let active = true;
    const highlight = () => {
      queueMicrotask(() => {
        if (!active || !editor.getBlock(focusBlock)) return;
        editor.setTextCursorPosition(focusBlock, "start");
        editor.focus();
        node = Array.from(
          editor.domElement?.querySelectorAll<HTMLElement>("[data-id]") ?? [],
        ).find((element) => element.dataset.id === focusBlock);
        node?.scrollIntoView({ block: "center" });
      });
    };
    const stop = editor.onMount(highlight);
    highlight();
    return () => {
      active = false;
      stop();
    };
  }, [editor, focusBlock]);

  function insertPage(page: KnowledgePage) {
    editor.insertInlineContent([
      { type: "pageMention", props: { pageId: page.id, label: page.title } },
      " ",
    ]);
  }
  function createLinkedPage(title: string) {
    setLinking(true);
    setLinkError("");
    const task = links
      .create(title)
      .then(insertPage)
      .catch((reason: unknown) => {
        // SuggestionMenu clears the query first. Restore it on failure so no typed name is lost.
        editor.insertInlineContent([`[[${title}]]`]);
        setLinkError(
          reason instanceof Error
            ? reason.message
            : "Creazione non riuscita. Il nome è conservato come testo: riprova con [[.",
        );
        throw reason;
      })
      .finally(() => {
        linkingTask.current = null;
        setLinking(false);
      });
    linkingTask.current = task;
    void task.catch(() => {});
  }
  async function getItems(
    query: string,
  ): Promise<DefaultReactSuggestionItem[]> {
    const title = query.replace(/\]\]$/, "").trim();
    const items: DefaultReactSuggestionItem[] = matchingPages(
      links.pages,
      query,
    ).map((page) => ({
      title: page.title,
      subtext: `${pageKinds[page.kind]}${page.status === "stub" ? " · Bozza" : ""}${page.aliases.length ? ` · Alias: ${page.aliases.join(", ")}` : ""}`,
      onItemClick: () => insertPage(page),
    }));
    if (canCreatePage(links.pages, query))
      items.push({
        title: `Crea bozza «${title}»`,
        subtext: "Nuova pagina nel Codex di questa campagna",
        onItemClick: () => createLinkedPage(title),
      });
    return items;
  }

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
      {linkError ? (
        <p className="error" role="alert">
          {linkError}
        </p>
      ) : null}
      {linking ? <p role="status">Creazione pagina…</p> : null}
      <div
        className="note-sheet"
        aria-label={it.notes}
        data-focused-source={focusBlock}
      >
        {focusBlock ? (
          <style>{`.note-sheet .bn-block-outer[data-id="${CSS.escape(focusBlock)}"] { outline: 2px solid #d7b978; outline-offset: 4px; }`}</style>
        ) : null}
        <BlockNoteView
          editor={editor}
          theme="light"
          emojiPicker={false}
          editable={!linking && !props.disabled}
          onChange={() =>
            saver.change({
              ...session.document,
              version: 1,
              blocks: editor.document,
            })
          }
        >
          <SuggestionMenuController
            triggerCharacter="[["
            minQueryLength={1}
            getItems={getItems}
          />
        </BlockNoteView>
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
    <EditorBoundary
      document={
        "session" in props ? props.session.document : props.page.document
      }
    >
      <NoteEditor {...props} />
    </EditorBoundary>
  );
}
