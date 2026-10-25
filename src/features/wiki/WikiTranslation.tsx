import { useEffect, useRef, useState, type ReactNode } from "react";
import { localeInfo } from "../../i18n/locales";
import { systemMessage, tr, usePreferences } from "../../i18n/store";
import { command, errorMessage } from "../journal/api";
import type { Block } from "./wikidot";
import {
  PRIMARY_MODEL,
  SECONDARY_MODEL,
  modelLabel,
} from "../assistant/models";

interface Translation {
  locale: string;
  title: string;
  blocks: Block[];
  model: string;
  sourceHash: string;
}
// Provider text may contain repeated cells or paragraphs. Content plus its
// occurrence gives stable, distinct keys without assigning identity by position.
function withKeys<T>(values: T[]) {
  const seen = new Map<string, number>();
  return values.map((value) => {
    const content = JSON.stringify(value);
    const occurrence = seen.get(content) ?? 0;
    seen.set(content, occurrence + 1);
    return { value, key: `${content}:${occurrence}` };
  });
}
export function WikiBlock({ block }: { block: Block }) {
  switch (block.kind) {
    case "heading":
      return <h5>{block.text}</h5>;
    case "paragraph":
      return <p className="wiki-prose">{block.text}</p>;
    case "list":
      return (
        <ul>
          {withKeys(block.items).map(({ value: text, key }) => (
            <li className="wiki-prose" key={key}>
              {text}
            </li>
          ))}
        </ul>
      );
    case "table":
      return (
        <div className="wiki-table">
          <table>
            <tbody>
              {withKeys(block.rows).map(({ value: row, key }) => (
                <tr key={key}>
                  {withKeys(row).map(({ value: cell, key: cellKey }) => (
                    <td key={cellKey}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

export default function WikiTranslation({
  provider,
  sourceKey,
  sourceVersion,
  children,
}: {
  provider: "wikidot" | "open5e";
  sourceKey: string;
  sourceVersion: string;
  children: ReactNode;
}) {
  const { locale } = usePreferences();
  const [model, setModel] = useState(PRIMARY_MODEL);
  // A locale/content change unmounts the request owner and drops late results.
  return (
    <TranslationView
      key={`${provider}:${sourceKey}:${sourceVersion}:${locale}:${model}`}
      provider={provider}
      sourceKey={sourceKey}
      locale={locale}
      model={model}
      onModelChange={setModel}
    >
      {children}
    </TranslationView>
  );
}
function TranslationView({
  provider,
  sourceKey,
  locale,
  model,
  onModelChange,
  children,
}: {
  provider: "wikidot" | "open5e";
  sourceKey: string;
  locale: ReturnType<typeof usePreferences>["locale"];
  model: string;
  onModelChange: (model: string) => void;
  children: ReactNode;
}) {
  const [translation, setTranslation] = useState<Translation | null>(null);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(true);
  const [error, setError] = useState("");
  const active = useRef(true);
  const request = useRef<string | null>(null);
  const supported = !["tlh", "art-x-rihan"].includes(locale);
  const original = locale === "en";
  useEffect(() => {
    active.current = true;
    if (supported && !original) {
      void command<Translation | null>("read_wiki_translation", {
        provider,
        key: sourceKey,
        locale,
        model,
      })
        .then((value) => {
          if (active.current) setTranslation(value);
        })
        .catch((reason) => {
          if (active.current) setError(errorMessage(reason));
        })
        .finally(() => {
          if (active.current) setReading(false);
        });
    }
    return () => {
      active.current = false;
      if (request.current)
        void command("cancel_local_ai", { id: request.current }).catch(
          () => undefined,
        );
    };
  }, [provider, sourceKey, locale, model, supported, original]);
  async function translate() {
    if (busy || request.current) return;
    const id = crypto.randomUUID();
    request.current = id;
    setBusy(true);
    setError("");
    try {
      const value = await command<Translation>("translate_wiki", {
        request: {
          provider,
          key: sourceKey,
          locale,
          requestId: id,
          model,
        },
      });
      if (active.current && request.current === id) setTranslation(value);
    } catch (reason) {
      if (active.current && request.current === id)
        setError(errorMessage(reason));
    } finally {
      if (request.current === id) request.current = null;
      if (active.current) setBusy(false);
    }
  }
  async function cancel() {
    if (!request.current) return;
    try {
      await command("cancel_local_ai", { id: request.current });
    } catch (reason) {
      if (active.current) setError(errorMessage(reason));
    }
  }
  if (original)
    return (
      <div lang="en" dir="ltr">
        {children}
      </div>
    );
  return (
    <section
      className="wiki-translation"
      aria-label={tr("Traduzione della voce wiki")}
    >
      <p className="editor-hint">
        {supported
          ? tr(
              "Traduzione locale in {0}. Richiede Ollama senza cloud e il modello selezionato già installato. Nessun testo viene inviato a servizi esterni; nessun download o cambio di AI automatico.",
              [localeInfo(locale).name],
            )
          : tr(
              "Traduzione wiki non disponibile per questa lingua. Consulta l’originale.",
            )}
      </p>
      {supported ? (
        <label>
          {tr("Modello per la traduzione")}
          <select
            aria-label={tr("Modello per la traduzione")}
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
          >
            {[PRIMARY_MODEL, SECONDARY_MODEL].map((name) => (
              <option key={name} value={name}>
                {modelLabel(name)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {translation ? (
        <>
          <p role="status">
            {tr(
              "Bozza automatica · {0} · {1}. Verifica sempre le regole sull’originale.",
              [localeInfo(locale).name, translation.model],
            )}
          </p>
          <div lang={locale} dir={localeInfo(locale).dir}>
            <h4>{translation.title}</h4>
            {withKeys(translation.blocks).map(({ value: block, key }) => (
              <WikiBlock key={key} block={block} />
            ))}
          </div>
        </>
      ) : null}
      {supported && !translation ? (
        <button disabled={busy || reading} onClick={() => void translate()}>
          {tr("Traduci in {0}", [localeInfo(locale).name])}
        </button>
      ) : null}
      {supported && reading ? (
        <p role="status">{tr("Lettura della traduzione salvata…")}</p>
      ) : null}
      {busy ? (
        <div>
          <p role="status">
            {tr("Traduzione sul dispositivo… L’originale resta consultabile.")}
          </p>
          <button onClick={() => void cancel()}>
            {tr("Annulla traduzione")}
          </button>
        </div>
      ) : null}
      {error ? (
        <p className="error" role="alert">
          {systemMessage(error)}
        </p>
      ) : null}
      {translation ? (
        <details>
          <summary>{tr("Mostra originale")}</summary>
          <div lang="en" dir="ltr">
            {children}
          </div>
        </details>
      ) : (
        <div lang="en" dir="ltr">
          {children}
        </div>
      )}
    </section>
  );
}
