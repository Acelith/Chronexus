import { useState } from "react";
import { tr } from "../../i18n/store";
import { backupApi } from "../backup/api";
import { command, errorMessage } from "../journal/api";
import { knowledgeApi } from "../knowledge/api";
import { playerApi, type CharacterInput } from "../player/api";
import { parseCharacterJson } from "./characterJson";

export default function CharacterImport({
  campaignId,
  onImported,
}: {
  campaignId: string;
  onImported: () => Promise<unknown>;
}) {
  const [draft, setDraft] = useState<{
    name: string;
    raw: string;
    input: CharacterInput;
  } | null>(null);
  const [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [backupPath, setBackupPath] = useState(""),
    [done, setDone] = useState(false);
  async function prepare(file?: File) {
    setDraft(null);
    setError("");
    setDone(false);
    setBackupPath("");
    if (!file) return;
    setPending(true);
    try {
      if (file.size > 1_000_000)
        throw Error(tr("Character JSON exceeds 1 MB."));
      const raw = new TextDecoder("utf-8", {
        fatal: true,
        ignoreBOM: true,
      }).decode(await file.arrayBuffer());
      setDraft({
        name: file.name,
        raw,
        input: parseCharacterJson(JSON.parse(raw)),
      });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPending(false);
    }
  }
  async function importCharacter() {
    if (!draft || pending) return;
    setPending(true);
    setError("");
    try {
      if (await playerApi.character(campaignId))
        throw Error(
          tr("This campaign already has a character. No sheet was replaced."),
        );
      const backup = await backupApi.create();
      if (!backup) return;
      setBackupPath(backup.path);
      await playerApi.saveCharacter(campaignId, null, draft.input);
      const page = await knowledgeApi.create(campaignId, {
        title: `Character JSON source — ${draft.input.name.slice(0, 140)} · ${crypto.randomUUID().slice(0, 8)}`,
        kind: "note",
        status: "active",
        aliases: [],
      });
      await command("add_import_source", {
        campaignId,
        kind: "page",
        id: page.id,
        name: draft.name,
        content: draft.raw,
      });
      setDone(true);
      setDraft(null);
      await onImported();
    } catch (e) {
      setError(
        `${errorMessage(e)} ${tr("Restore the backup if any import step failed.")}`,
      );
      await onImported();
    } finally {
      setPending(false);
    }
  }
  return (
    <section
      className="language-settings"
      aria-label={tr("Import character JSON")}
    >
      <h4>{tr("Import character JSON")}</h4>
      <p>
        {tr(
          "Supports the documented D&D 5e 2014 Character.schema.json format. Review the mapped fields before import; the full original is kept locally.",
        )}
      </p>
      <input
        type="file"
        accept=".json,application/json"
        aria-label={tr("Choose character JSON")}
        disabled={pending}
        onChange={(e) => void prepare(e.target.files?.[0])}
      />
      {draft && (
        <div>
          <dl>
            <dt>{tr("Name")}</dt>
            <dd>{draft.input.name}</dd>
            <dt>{tr("Ancestry")}</dt>
            <dd>{draft.input.ancestry}</dd>
            <dt>{tr("Class")}</dt>
            <dd>{draft.input.vocation}</dd>
            <dt>{tr("Hit points")}</dt>
            <dd>
              {draft.input.hpCurrent} / {draft.input.hpMaximum}
            </dd>
          </dl>
          <p>
            {tr(
              "Spells and equipment remain in the original JSON; they are not added automatically.",
            )}
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() => void importCharacter()}
          >
            {tr("Back up and import character")}
          </button>
        </div>
      )}
      {pending && <p role="status">{tr("Import in progress…")}</p>}
      {backupPath && (
        <p role="status">{tr("Pre-import backup: {0}", [backupPath])}</p>
      )}
      {done && <p role="status">{tr("Character imported.")}</p>}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </section>
  );
}
