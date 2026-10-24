import type { ReactNode } from "react";
import type { SaveState } from "./autosave";
import { it } from "../../strings";
export function EditorSaveBar({
  state,
  sourceDirty,
  blocked,
  onSave,
}: {
  state: SaveState;
  sourceDirty: boolean;
  blocked: boolean;
  onSave: () => void;
}) {
  const status = {
    saved: it.saved,
    dirty: it.dirty,
    saving: it.saving,
    error: it.failed,
  }[state.kind];
  return (
    <div className="save-bar">
      <span role="status" className={`save-state ${state.kind}`}>
        {sourceDirty ? "Markdown da applicare e salvare" : status}
      </span>
      <button
        type="button"
        disabled={
          (!sourceDirty && state.kind === "saved") ||
          state.kind === "saving" ||
          blocked
        }
        onClick={onSave}
      >
        {state.kind === "error" ? it.retry : it.saveNow}
      </button>
    </div>
  );
}
export function EditorModeBar({
  mode,
  disabled,
  dirty,
  onVisual,
  onMarkdown,
  onDiscard,
  children,
}: {
  mode: "visual" | "markdown";
  disabled: boolean;
  dirty: boolean;
  onVisual: () => void;
  onMarkdown: () => void;
  onDiscard: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="editor-command-bar"
      role="toolbar"
      aria-label="Comandi degli appunti"
    >
      <div className="editor-mode">
        <button
          type="button"
          aria-pressed={mode === "visual"}
          disabled={disabled}
          onClick={onVisual}
        >
          Visuale
        </button>
        <button
          type="button"
          aria-pressed={mode === "markdown"}
          disabled={disabled || mode === "markdown"}
          onClick={onMarkdown}
        >
          Markdown
        </button>
      </div>
      {mode === "visual" ? (
        children
      ) : (
        <>
          <button
            type="button"
            disabled={disabled || !dirty}
            onClick={onVisual}
          >
            Applica e torna al visuale
          </button>
          <button type="button" disabled={disabled} onClick={onDiscard}>
            Annulla modifiche Markdown
          </button>
        </>
      )}
    </div>
  );
}
