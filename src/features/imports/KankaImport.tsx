import { useState } from "react";
import { tr } from "../../i18n/store";
import { backupApi } from "../backup/api";
import { graphApi } from "../graph/api";
import { command, errorMessage } from "../journal/api";
import { knowledgeApi, pageKinds } from "../knowledge/api";
import {
  entryText,
  kankaApi,
  kankaRelations,
  kankaTitles,
  kankaWarning,
  type KankaPreview,
} from "./kanka";
import { document } from "./markdown";

export default function KankaImport({
  campaignId,
  existingTitles,
  onImported,
}: {
  campaignId: string;
  existingTitles: string[];
  onImported: () => Promise<unknown>;
}) {
  const [preview, setPreview] = useState<KankaPreview | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState("");
  const [done, setDone] = useState("");
  const titles = preview ? kankaTitles(preview.entities, existingTitles) : null;
  const relations = preview ? kankaRelations(preview.entities) : null;
  const renamed = preview
    ? preview.entities.filter((e) => titles?.get(e.sourceId) !== e.name).length
    : 0;

  async function choose() {
    setPreview(null);
    setError("");
    setReceipt("");
    setDone("");
    setPending(true);
    try {
      setPreview(await kankaApi.inspect());
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setPending(false);
    }
  }

  async function importAll() {
    if (!preview || !titles || !relations || pending) return;
    setPending(true);
    setError("");
    try {
      const backup = await backupApi.create();
      if (!backup) return;
      setReceipt(backup.path);
      const pages = new Map<string, string>();
      for (const entity of preview.entities) {
        const page = await knowledgeApi.create(campaignId, {
          title: titles.get(entity.sourceId) ?? entity.name,
          kind: entity.kind in pageKinds ? entity.kind : "note",
          status: "active",
          aliases: [],
        });
        pages.set(entity.sourceId, page.id);
        await knowledgeApi.save(
          page,
          page.revision,
          document(entryText(entity.entry), new Map(), () => null),
        );
        await command("add_import_source", {
          campaignId,
          kind: "page",
          id: page.id,
          name: entity.path,
          content: entity.original,
        });
      }
      for (const relation of relations.kept) {
        const from = pages.get(relation.from),
          to = pages.get(relation.to);
        if (!from || !to) continue;
        await graphApi.save(campaignId, {
          fromPageId: from,
          toPageId: to,
          label: relation.label,
          certainty: "unknown",
          sourceKind: "page",
          sourceId: from,
          sourceBlockId: null,
          evidence: tr("Imported from Kanka as an unconfirmed relation."),
          notes: "",
        });
      }
      setDone(
        tr("Kanka import finished: {0} pages, {1} unconfirmed relations.", [
          preview.entities.length,
          relations.kept.length,
        ]),
      );
      setPreview(null);
      await onImported();
    } catch (reason) {
      setError(
        `${errorMessage(reason)} ${tr("Restore the backup to undo this import.")}`,
      );
      await onImported();
      setPreview(null);
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-label={tr("Import from Kanka")} className="language-settings">
      <h4>{tr("Import from Kanka")}</h4>
      <p>
        {tr(
          "Choose a Kanka JSON export ZIP (version 2.1 or later). Entities become pages; Kanka relations become unconfirmed relations. A backup is required before any change.",
        )}
      </p>
      <button type="button" disabled={pending} onClick={() => void choose()}>
        {tr("Choose Kanka export…")}
      </button>
      {pending && <p role="status">{tr("Import in progress…")}</p>}
      {preview && titles && relations && (
        <div>
          <p>
            {tr("Kanka {0}: {1} pages, {2} relation candidates.", [
              preview.version,
              preview.entities.length,
              relations.kept.length,
            ])}
          </p>
          <ul>
            {preview.entities.slice(0, 20).map((entity) => (
              <li key={entity.path}>
                <bdi>{titles.get(entity.sourceId)}</bdi> ·{" "}
                {pageKinds[entity.kind] ?? entity.kind}
              </li>
            ))}
          </ul>
          {preview.entities.length > 20 && (
            <p>{tr("Additional pages: {0}", [preview.entities.length - 20])}</p>
          )}
          {renamed > 0 && (
            <p>
              {tr(
                "{0} names already exist or repeat; their Kanka ID is added to the title.",
                [renamed],
              )}
            </p>
          )}
          {relations.missing > 0 && (
            <p>
              {tr(
                "{0} relations point outside this export and will not be imported.",
                [relations.missing],
              )}
            </p>
          )}
          {preview.warnings.length > 0 && (
            <details>
              <summary>
                {tr("Import warnings: {0}", [preview.warnings.length])}
              </summary>
              <ul>
                {preview.warnings.map((warning) => (
                  <li key={`${warning.name}:${warning.reason}`}>
                    <bdi>{warning.name}</bdi>: {kankaWarning(warning.reason)}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={() => void importAll()}
          >
            {tr("Back up and import")}
          </button>
        </div>
      )}
      {receipt && (
        <p role="status">{tr("Pre-import backup: {0}", [receipt])}</p>
      )}
      {done && <p role="status">{done}</p>}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </section>
  );
}
