import { tr } from "../../i18n/store";
import { Text } from "../../i18n/Text";
import type { ReactNode } from "react";
import type { SaveState } from "./autosave";
import { appText } from "../../strings";
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
    saved: appText.saved,
    dirty: appText.dirty,
    saving: appText.saving,
    error: appText.failed,
  }[state.kind];
  return (
    <div className="save-bar">
      <span role="status" className={`save-state ${state.kind}`}>
        {sourceDirty ? tr("Markdown to apply and save") : status}
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
        {state.kind === "error" ? appText.retry : appText.saveNow}
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
      aria-label={tr("Note commands")}
    >
      <div className="editor-mode">
        <button
          type="button"
          aria-pressed={mode === "visual"}
          disabled={disabled}
          onClick={onVisual}
        >
          <Text source={"Visual"} />
        </button>
        <button
          type="button"
          aria-pressed={mode === "markdown"}
          disabled={disabled || mode === "markdown"}
          onClick={onMarkdown}
        >
          <Text source={"Markdown"} />
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
            <Text source={"Apply and return to visual mode"} />
          </button>
          <button type="button" disabled={disabled} onClick={onDiscard}>
            <Text source={"Discard Markdown changes"} />
          </button>
        </>
      )}
    </div>
  );
}
