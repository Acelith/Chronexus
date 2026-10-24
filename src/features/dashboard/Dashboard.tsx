import { tr } from "../../i18n/store";
import { Text } from "../../i18n/Text";
import { useEffect, useState } from "react";
import { playerApi, type Character } from "../player/api";
import { errorMessage, type Session } from "../journal/api";
import { pageKinds, type KnowledgePage } from "../knowledge/api";
import { blockOptions } from "../knowledge/blocks";
export default function Dashboard({
  campaignId,
  sessions,
  pages,
  onSession,
  onPage,
  onCharacter,
  onNewSession,
}: {
  campaignId: string;
  sessions: Session[];
  pages: KnowledgePage[];
  onSession: (s: Session) => void;
  onPage: (p: KnowledgePage) => void;
  onCharacter: () => void;
  onNewSession: () => void;
}) {
  const [character, setCharacter] = useState<Character | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    playerApi
      .character(campaignId)
      .then((pc) => {
        if (active) {
          setCharacter(pc);
          setError("");
        }
      })
      .catch((e) => {
        if (active) setError(errorMessage(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [campaignId, refresh]);
  const last = sessions.at(-1);
  const recent = [...pages]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 6);
  return (
    <section
      className="campaign-dashboard"
      aria-label={tr("Riepilogo della campagna")}
    >
      <h3>
        <Text source={"Il punto della campagna"} />
      </h3>
      <dl className="dashboard-ledger">
        <div>
          <dt>
            <Text source={"Sessioni"} />
          </dt>
          <dd>{sessions.length}</dd>
        </div>
        <div>
          <dt>
            <Text source={"Pagine del Codex"} />
          </dt>
          <dd>{pages.length}</dd>
        </div>
        <div>
          <dt>
            <Text source={"Bozze da completare"} />
          </dt>
          <dd>{pages.filter((p) => p.status === "stub").length}</dd>
        </div>
      </dl>
      <div className="dashboard-columns">
        <section>
          <h4>
            <Text source={"Riprendi il diario"} />
          </h4>
          {last ? (
            <>
              <button
                className="dashboard-session"
                onClick={() => onSession(last)}
              >
                <span>
                  <Text source={"Sessione "} />
                  {last.sequence}
                  {last.playedOn ? tr(" · {0}", [last.playedOn]) : ""}
                </span>
                <strong>{last.title}</strong>
                <p>
                  {blockOptions(last.document)
                    .find((b) => b.text.trim())
                    ?.text.slice(0, 240) ||
                    tr("Gli appunti della sessione sono ancora vuoti.")}
                </p>
              </button>
            </>
          ) : (
            <p>
              <Text
                source={
                  "Il diario è vuoto. Crea la prima sessione per iniziare a prendere appunti."
                }
              />
            </p>
          )}
          <button onClick={onNewSession}>
            <Text source={"Nuova sessione"} />
          </button>
          <p className="muted">
            <Text source={"Scorciatoia: Ctrl/⌘ + Shift + N"} />
          </p>
          <h4>
            <Text source={"Il tuo personaggio"} />
          </h4>
          {error ? (
            <div role="alert">
              <p>{error}</p>
              <button
                onClick={() => {
                  setLoading(true);
                  setRefresh((n) => n + 1);
                }}
              >
                <Text source={"Riprova scheda"} />
              </button>
            </div>
          ) : loading ? (
            <p role="status">
              <Text source={"Apertura scheda…"} />
            </p>
          ) : (
            <>
              <p>
                {character
                  ? tr("{0} · {1}", [
                      character.data.name,
                      character.data.vocation || character.data.systemId,
                    ])
                  : tr("Nessun personaggio creato per questa campagna.")}
              </p>
              <button onClick={onCharacter}>
                {character ? tr("Apri scheda") : tr("Crea la scheda")}
              </button>
            </>
          )}
        </section>
        <section>
          <h4>
            <Text source={"Pagine aggiornate di recente"} />
          </h4>
          {recent.length ? (
            <nav className="dashboard-pages" aria-label={tr("Pagine recenti")}>
              {recent.map((page) => (
                <button key={page.id} onClick={() => onPage(page)}>
                  <span>{pageKinds[page.kind]}</span>
                  <strong>{page.title}</strong>
                </button>
              ))}
            </nav>
          ) : (
            <p>
              <Text
                source={
                  "Il Codex è vuoto. Crea pagine o collegamenti [[ dal diario."
                }
              />
            </p>
          )}
          <p className="muted">
            <Text
              source={
                "La ricerca Ctrl/⌘ + K trova anche le parole dentro gli appunti. Ritratti e mappe si aggiungono nelle immagini di ogni voce."
              }
            />
          </p>
        </section>
      </div>
    </section>
  );
}
