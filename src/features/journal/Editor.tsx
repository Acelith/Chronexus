import { systemMessage } from "../../i18n/store";
import { tr } from "../../i18n/store";
import { Text } from "../../i18n/Text";
import { EditorSaveBar, EditorModeBar } from "./EditorChrome";
import {
  Component,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { type PartialBlock } from "@blocknote/core";
import { editorDictionary } from "../../i18n/editorLocale";
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
import {
  markdownBlocks,
  markdownForParser,
  markdownForSource,
  restoreMarkdownBlocks,
  validateMarkdown,
} from "./markdown";
import { schema } from "./schema";
import WordToolbar from "./WordToolbar";
import { KnowledgeContext } from "../knowledge/context";
import { knowledgeApi, pageKinds, type KnowledgePage } from "../knowledge/api";
import { canCreatePage, matchingPages } from "../knowledge/links";

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
  const [mode, setMode] = useState<"visual" | "markdown">("visual");
  const [source, setSource] = useState("");
  const [sourceDirty, setSourceDirty] = useState(false);
  const sourceDraft = useRef({ text: "", original: "", dirty: false });
  const applySource = useRef<() => void>(() => {});
  const [sourceError, setSourceError] = useState("");
  if (
    session.document.version !== 1 ||
    !Array.isArray(session.document.blocks) ||
    !session.document.blocks.length
  )
    throw new Error(it.unavailable);
  const editor = useCreateBlockNote({
    schema,
    dictionary: editorDictionary(),
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
        applySource.current();
        await saver.flush();
      },
      dirty: () =>
        saver.dirty ||
        sourceDraft.current.dirty ||
        linkingTask.current !== null,
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

  function applyMarkdown() {
    if (!sourceDraft.current.dirty) return;
    try {
      validateMarkdown(sourceDraft.current.text);
      const parsed = editor.tryParseMarkdownToBlocks(
        markdownForParser(sourceDraft.current.text),
      );
      const restored = restoreMarkdownBlocks(
        parsed,
        editor.document,
      ) as PartialBlock<typeof schema.blockSchema>[];
      editor.replaceBlocks(
        editor.document,
        restored.length ? restored : [{ type: "paragraph", content: [] }],
      );
      saver.change({ ...session.document, blocks: editor.document });
      sourceDraft.current.dirty = false;
      setSourceDirty(false);
      sourceDraft.current.original = sourceDraft.current.text;
      setSourceError("");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : tr("Markdown non valido. Il testo è conservato.");
      setSourceError(message);
      throw Error(message, { cause: error });
    }
  }
  useEffect(() => {
    applySource.current = applyMarkdown;
  });
  function openMarkdown() {
    setSourceDirty(false);
    const text = markdownForSource(
      editor.blocksToMarkdownLossy(
        markdownBlocks(editor.document) as PartialBlock<
          typeof schema.blockSchema
        >[],
      ),
    );
    sourceDraft.current = { text, original: text, dirty: false };
    setSource(text);
    setSourceError("");
    setMode("markdown");
  }
  function showVisual() {
    try {
      applyMarkdown();
      setMode("visual");
    } catch {
      /* error shown without losing source */
    }
  }
  const blocked = linking || props.disabled;

  function insertPage(page: KnowledgePage) {
    editor.insertInlineContent([
      {
        type: "pageMention",
        props: { pageId: page.id, label: page.title },
      },
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
            : tr(
                "Creazione non riuscita. Il nome è conservato come testo: riprova con [[.",
              ),
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
        subtext: tr("Nuova pagina nel Codex di questa campagna"),
        onItemClick: () => createLinkedPage(title),
      });
    return items;
  }

  return (
    <>
      <EditorSaveBar
        state={state}
        sourceDirty={sourceDirty}
        blocked={!!props.disabled}
        onSave={() => {
          try {
            applyMarkdown();
            void saver.flush().catch(() => {});
          } catch {
            /* error shown */
          }
        }}
      />
      {state.kind === "error" ? (
        <p className="error" role="alert">
          {systemMessage(state.message)}
        </p>
      ) : null}
      {linkError ? (
        <p className="error" role="alert">
          {linkError}
        </p>
      ) : null}
      {linking ? (
        <p role="status">
          <Text source={"Creazione pagina…"} />
        </p>
      ) : null}
      <EditorModeBar
        mode={mode}
        disabled={!!blocked}
        dirty={sourceDirty}
        onVisual={showVisual}
        onMarkdown={openMarkdown}
        onDiscard={() => {
          sourceDraft.current.dirty = false;
          setSourceDirty(false);
          setSourceError("");
          setMode("visual");
        }}
      >
        <WordToolbar
          editor={editor}
          blocked={!!blocked}
          pages={links.pages}
          insertPage={insertPage}
        />
      </EditorModeBar>
      {sourceError ? (
        <p role="alert" className="error">
          {sourceError}
        </p>
      ) : null}
      {mode === "markdown" ? (
        <>
          <p className="editor-hint">
            <Text
              source={
                "Modifica titoli, elenchi, attività, citazioni, grassetto, corsivo e link. I collegamenti al Codex conservano l’UUID. Colori, sottolineatura e allineamento sono formati visuali: il Markdown standard non li rappresenta: restano nei blocchi non modificati. Tabelle, immagini e HTML non vengono convertiti."
              }
            />
          </p>
          <textarea
            dir="auto"
            className="markdown-source"
            aria-label={tr("Codice Markdown")}
            spellCheck={false}
            value={source}
            disabled={blocked}
            onChange={(e) => {
              setSource(e.target.value);
              sourceDraft.current.text = e.target.value;
              sourceDraft.current.dirty =
                e.target.value !== sourceDraft.current.original;
              setSourceDirty(sourceDraft.current.dirty);
            }}
          />
        </>
      ) : null}
      <div
        className="note-sheet"
        hidden={mode === "markdown"}
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
          editable={!blocked && mode === "visual"}
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
          dir="auto"
          aria-label={tr("Documento originale")}
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
