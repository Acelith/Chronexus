import { useEffect, useRef, useState } from "react";
import { systemMessage, tr } from "../../i18n/store";
import { Text } from "../../i18n/Text";
import { errorMessage } from "../journal/api";
import type { AbilityDetails } from "../player/api";
import Open5eWiki from "./Open5eWiki";
import WikidotWiki, { type Unavailable } from "./WikidotWiki";
import {
  providerNames,
  WIKI_CHANGED,
  wikiProviderApi,
  type WikiChoice,
} from "./provider";

/**
 * Shows the globally selected wiki. A Wikidot failure only proposes Open5e:
 * nothing is sent to Open5e and nothing is saved unless the user accepts.
 */
export default function WikiWorkspace({
  onImportSpell,
}: {
  onImportSpell?: (spell: AbilityDetails) => void;
}) {
  const [choice, setChoice] = useState<WikiChoice | null>(null);
  const [error, setError] = useState("");
  const [prompt, setPrompt] = useState<Unavailable | null>(null);
  const [handoff, setHandoff] = useState("");
  const [saving, setSaving] = useState(false);
  const [generation, setGeneration] = useState(0);
  const accept = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    let active = true;
    const load = () =>
      wikiProviderApi
        .get()
        .then((value) => {
          if (!active) return;
          setChoice(value);
          setError("");
          // Remount the views: cleared caches or another provider invalidate them.
          setGeneration((g) => g + 1);
        })
        .catch((reason) => {
          if (active) setError(errorMessage(reason));
        });
    void load();
    window.addEventListener(WIKI_CHANGED, load);
    return () => {
      active = false;
      window.removeEventListener(WIKI_CHANGED, load);
    };
  }, []);
  useEffect(() => {
    if (prompt) accept.current?.focus();
  }, [prompt]);
  async function switchToOpen5e() {
    if (!prompt || saving) return;
    setSaving(true);
    try {
      const saved = await wikiProviderApi.save("open5e");
      // One consented search is repeated on Open5e; no further automatic requests.
      setHandoff(prompt.query);
      setPrompt(null);
      setChoice(saved);
    } catch (reason) {
      setError(errorMessage(reason));
      setPrompt(null);
    } finally {
      setSaving(false);
    }
  }
  return (
    <section
      className="wiki-workspace"
      aria-label={tr("Wiki Dungeons & Dragons")}
    >
      <h3>
        <Text source={"Biblioteca delle regole"} />
      </h3>
      {choice ? (
        <p className="wiki-provider">
          {tr("Fonte attiva: {0}", [providerNames[choice.provider]])}
          {" · "}
          <Text
            source={
              "Puoi cambiarla in Impostazioni dell’app → Fonti D&D / Wiki."
            }
          />
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="error">
          {systemMessage(error)}
        </p>
      ) : null}
      {!choice && !error ? (
        <p role="status">
          <Text source={"Lettura della fonte wiki…"} />
        </p>
      ) : null}
      {choice?.provider === "wikidot" ? (
        <WikidotWiki
          key={`wikidot:${generation}`}
          onUnavailable={setPrompt}
          onImportSpell={onImportSpell}
        />
      ) : null}
      {choice?.provider === "open5e" ? (
        <Open5eWiki key={`open5e:${generation}`} initialQuery={handoff} />
      ) : null}
      {prompt ? (
        <div
          className="wiki-confirm"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="wiki-switch-title"
          aria-describedby="wiki-switch-reason"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              setPrompt(null);
            }
          }}
        >
          <h4 id="wiki-switch-title">
            <Text
              source={
                "Wikidot non ha fornito le informazioni. Vuoi usare Open5e?"
              }
            />
          </h4>
          <p id="wiki-switch-reason">{systemMessage(prompt.reason)}</p>
          <p>
            {prompt.query.trim().length >= 2
              ? tr(
                  "Accettando, Open5e diventa la fonte salvata nelle impostazioni dell’app e la ricerca «{0}» viene ripetuta lì. Rifiutando resti su Wikidot e nessuna richiesta viene inviata a Open5e.",
                  [prompt.query],
                )
              : tr(
                  "Accettando, Open5e diventa la fonte salvata nelle impostazioni dell’app. Rifiutando resti su Wikidot e nessuna richiesta viene inviata a Open5e.",
                )}
          </p>
          <div className="actions">
            <button
              ref={accept}
              className="primary"
              disabled={saving}
              onClick={() => void switchToOpen5e()}
            >
              <Text source={"Usa Open5e e salva la scelta"} />
            </button>
            <button
              disabled={saving}
              onClick={() => {
                const retry = prompt.retry;
                setPrompt(null);
                retry();
              }}
            >
              <Text source={"Riprova su Wikidot"} />
            </button>
            <button disabled={saving} onClick={() => setPrompt(null)}>
              <Text source={"Resta su Wikidot"} />
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
