import { tr } from "../../i18n/store";
import { Text } from "../../i18n/Text";
import { blockOptions } from "../knowledge/blocks";
import { useState } from "react";
import type { Session } from "../journal/api";
import type { KnowledgePage } from "../knowledge/api";
import {
  certainties,
  type Certainty,
  type Relationship,
  type RelationshipInput,
} from "./api";
export default function RelationshipForm({
  pages,
  sessions,
  initial,
  busy,
  onSave,
  onCancel,
}: {
  pages: KnowledgePage[];
  sessions: Session[];
  initial?: Relationship;
  busy: boolean;
  onSave: (input: RelationshipInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [from, setFrom] = useState(initial?.fromPageId ?? pages[0]?.id ?? "");
  const [to, setTo] = useState(
    initial?.toPageId ?? pages[1]?.id ?? pages[0]?.id ?? "",
  );
  const [label, setLabel] = useState(initial?.label ?? "");
  const [certainty, setCertainty] = useState<Certainty>(
    initial?.certainty ?? "unknown",
  );
  const [source, setSource] = useState(
    initial?.sourceId ? `${initial.sourceKind}:${initial.sourceId}` : "",
  );
  const [block, setBlock] = useState(initial?.sourceBlockId ?? "");
  const [evidence, setEvidence] = useState(initial?.evidence ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [sourceKind, sourceId] = source.split(":");
  const document =
    sourceKind === "session"
      ? sessions.find((s) => s.id === sourceId)?.document
      : pages.find((p) => p.id === sourceId)?.document;
  const blocks = document ? blockOptions(document) : [];
  return (
    <form
      className="entry-form relationship-form"
      aria-label={initial ? tr("Modifica relazione") : tr("Nuova relazione")}
      onSubmit={(event) => {
        event.preventDefault();
        void onSave({
          fromPageId: from,
          toPageId: to,
          label,
          certainty,
          sourceKind: (sourceKind as "session" | "page") || null,
          sourceId: sourceId || null,
          sourceBlockId: block || null,
          evidence,
          notes,
        });
      }}
    >
      <h3>
        {initial ? tr("Modifica relazione") : tr("Nuova relazione dichiarata")}
      </h3>
      <p className="editor-hint">
        <Text
          source={
            "Registra ciò che ritieni vero o sospetti. Questa relazione è distinta dalle citazioni negli appunti."
          }
        />
      </p>
      <div className="form-fields">
        <label>
          <Text source={"Da pagina"} />
          <select
            aria-label={tr("Da pagina")}
            required
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            disabled={busy}
          >
            {pages.map((page) => (
              <option key={page.id} value={page.id}>
                {page.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          <Text source={"A pagina"} />
          <select
            aria-label={tr("A pagina")}
            required
            value={to}
            onChange={(event) => setTo(event.target.value)}
            disabled={busy}
          >
            {pages.map((page) => (
              <option key={page.id} value={page.id}>
                {page.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        <Text source={"Etichetta della relazione"} />
        <input
          autoFocus
          required
          maxLength={100}
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          disabled={busy}
          placeholder={tr("es. accusa, appartiene a, cerca")}
        />
      </label>
      <label>
        <Text source={"Certezza"} />
        <select
          aria-label={tr("Certezza")}
          value={certainty}
          onChange={(event) => setCertainty(event.target.value as Certainty)}
          disabled={busy}
        >
          {Object.entries(certainties).map(([key, text]) => (
            <option key={key} value={key}>
              {text}
            </option>
          ))}
        </select>
      </label>
      <label>
        <Text source={"Fonte (facoltativa)"} />
        <select
          aria-label={tr("Fonte (facoltativa)")}
          value={source}
          onChange={(event) => {
            setSource(event.target.value);
            setBlock("");
          }}
          disabled={busy}
        >
          <option value="">{tr("Nessuna fonte selezionata")}</option>
          <optgroup label={tr("Sessioni")}>
            {sessions.map((session) => (
              <option key={session.id} value={`session:${session.id}`}>
                {tr("Sessione ")}
                {session.sequence}: {session.title}
              </option>
            ))}
          </optgroup>
          <optgroup label={tr("Pagine")}>
            {pages.map((page) => (
              <option key={page.id} value={`page:${page.id}`}>
                {page.title}
              </option>
            ))}
          </optgroup>
        </select>
      </label>
      <label>
        <Text source={"Blocco della fonte"} />
        <select
          aria-label={tr("Blocco della fonte")}
          value={block}
          disabled={!source || busy}
          onChange={(event) => setBlock(event.target.value)}
        >
          <option value="">{tr("Intero documento")}</option>
          {block && !blocks.some((item) => item.id === block) ? (
            <option value={block}>{tr("Blocco non più disponibile")}</option>
          ) : null}
          {blocks.map((item, index) => (
            <option key={item.id} value={item.id}>
              {index + 1}. {item.text}
            </option>
          ))}
        </select>
      </label>
      <label>
        <Text source={"Evidenza o citazione"} />
        <textarea
          rows={3}
          maxLength={4000}
          value={evidence}
          disabled={busy}
          onChange={(event) => setEvidence(event.target.value)}
        />
      </label>
      <label>
        <Text source={"Note sulla relazione"} />
        <textarea
          rows={3}
          maxLength={4000}
          value={notes}
          disabled={busy}
          onChange={(event) => setNotes(event.target.value)}
        />
      </label>
      <div className="actions">
        <button
          className="primary"
          disabled={busy || !from || !to || !label.trim()}
        >
          <Text source={"Salva relazione"} />
        </button>
        <button type="button" disabled={busy} onClick={onCancel}>
          <Text source={"Annulla relazione"} />
        </button>
      </div>
    </form>
  );
}
