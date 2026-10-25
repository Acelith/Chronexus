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
      aria-label={tr("Campaign overview")}
    >
      <h3>
        <Text source={"Campaign status"} />
      </h3>
      <dl className="dashboard-ledger">
        <div>
          <dt>
            <Text source={"Sessions"} />
          </dt>
          <dd>{sessions.length}</dd>
        </div>
        <div>
          <dt>
            <Text source={"Codex pages"} />
          </dt>
          <dd>{pages.length}</dd>
        </div>
        <div>
          <dt>
            <Text source={"Drafts to complete"} />
          </dt>
          <dd>{pages.filter((p) => p.status === "stub").length}</dd>
        </div>
      </dl>
      <div className="dashboard-columns">
        <section>
          <h4>
            <Text source={"Continue the journal"} />
          </h4>
          {last ? (
            <>
              <button
                className="dashboard-session"
                onClick={() => onSession(last)}
              >
                <span>
                  <Text source={"Session "} />
                  {last.sequence}
                  {last.playedOn ? tr(" · {0}", [last.playedOn]) : ""}
                </span>
                <strong>{last.title}</strong>
                <p>
                  {blockOptions(last.document)
                    .find((b) => b.text.trim())
                    ?.text.slice(0, 240) ||
                    tr("The session notes are still empty.")}
                </p>
              </button>
            </>
          ) : (
            <p>
              <Text
                source={
                  "The journal is empty. Create the first session to start taking notes."
                }
              />
            </p>
          )}
          <button onClick={onNewSession}>
            <Text source={"New session"} />
          </button>
          <p className="muted">
            <Text source={"Shortcut: Ctrl/⌘ + Shift + N"} />
          </p>
          <h4>
            <Text source={"Your character"} />
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
                <Text source={"Retry sheet"} />
              </button>
            </div>
          ) : loading ? (
            <p role="status">
              <Text source={"Opening sheet…"} />
            </p>
          ) : (
            <>
              <p>
                {character
                  ? tr("{0} · {1}", [
                      character.data.name,
                      character.data.vocation || character.data.systemId,
                    ])
                  : tr("No character created for this campaign.")}
              </p>
              <button onClick={onCharacter}>
                {character ? tr("Open sheet") : tr("Create the sheet")}
              </button>
            </>
          )}
        </section>
        <section>
          <h4>
            <Text source={"Recently updated pages"} />
          </h4>
          {recent.length ? (
            <nav className="dashboard-pages" aria-label={tr("Recent pages")}>
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
                  "The Codex is empty. Create pages or [[ links from the journal."
                }
              />
            </p>
          )}
          <p className="muted">
            <Text
              source={
                "The Ctrl/⌘ + K search also finds words inside notes. Portraits and maps are added in each entry's images."
              }
            />
          </p>
        </section>
      </div>
    </section>
  );
}
