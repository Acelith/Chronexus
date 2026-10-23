import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { command, errorMessage } from "../journal/api";
import type { SaveGuard } from "../journal/Editor";
import type { KnowledgePage } from "../knowledge/api";
const Editor = lazy(() => import("../journal/Editor"));
const ImageGallery = lazy(() => import("../images/ImageGallery"));
export interface Member {
  page: KnowledgePage;
  playerName: string;
  role: string;
  status: "active" | "former" | "unknown";
  revision: number;
}
interface Draft {
  pageId: string | null;
  name: string;
  playerName: string;
  role: string;
  status: Member["status"];
  revision: number | null;
}
const states = {
  active: "Nel party",
  former: "Ex membro",
  unknown: "Da chiarire",
};
const empty: Draft = {
  pageId: null,
  name: "",
  playerName: "",
  role: "",
  status: "active",
  revision: null,
};
export default function PartyWorkspace({
  campaignId,
  pages,
  register,
  onSaved,
  onOpen,
  busy = false,
}: {
  campaignId: string;
  pages: KnowledgePage[];
  register: (g: SaveGuard | null) => void;
  onSaved: (p: KnowledgePage) => void;
  onOpen: (p: KnowledgePage) => void;
  busy?: boolean;
}) {
  const [members, setMembers] = useState<Member[]>([]),
    [selectedId, setSelectedId] = useState<string | null>(null),
    [draft, setDraft] = useState<Draft | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [pending, setPending] = useState(false),
    [confirm, setConfirm] = useState(false),
    [attempt, setAttempt] = useState(0);
  const editor = useRef<SaveGuard | null>(null),
    state = useRef({ draft, pending, confirm });
  useLayoutEffect(() => {
    state.current = { draft, pending, confirm };
  }, [draft, pending, confirm]);
  const registerEditor = useCallback((g: SaveGuard | null) => {
    editor.current = g;
  }, []);
  useEffect(() => {
    register({
      dirty: () =>
        !!state.current.draft ||
        state.current.pending ||
        state.current.confirm ||
        !!editor.current?.dirty(),
      flush: async () => {
        if (
          state.current.draft ||
          state.current.pending ||
          state.current.confirm
        )
          throw Error(
            "Salva o annulla la modifica del party prima di cambiare vista.",
          );
        await editor.current?.flush();
      },
    });
    return () => register(null);
  }, [register]);
  useEffect(() => {
    let active = true;
    command<Member[]>("list_party", { campaignId })
      .then((v) => {
        if (active) {
          setMembers(v);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (active) {
          setError(errorMessage(e));
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [campaignId, attempt]);
  const selected = members.find((m) => m.page.id === selectedId);
  const page = pages.find((p) => p.id === selectedId) ?? selected?.page;
  async function move(action: () => void) {
    try {
      await editor.current?.flush();
      setError("");
      action();
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  async function save() {
    if (!draft) return;
    setPending(true);
    setError("");
    try {
      const member = await command<Member>("save_party_member", {
        campaignId,
        input: draft,
      });
      onSaved(member.page);
      setMembers((v) => [
        ...v.filter((m) => m.page.id !== member.page.id),
        member,
      ]);
      setSelectedId(member.page.id);
      setDraft(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPending(false);
    }
  }
  async function remove() {
    if (!selected) return;
    setPending(true);
    setError("");
    try {
      await command("remove_party_member", {
        campaignId,
        pageId: selected.page.id,
        revision: selected.revision,
      });
      setMembers((v) => v.filter((m) => m.page.id !== selected.page.id));
      setSelectedId(null);
      setConfirm(false);
    } catch (e) {
      setError(errorMessage(e));
      setConfirm(false);
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="party-workspace" aria-label="Party della campagna">
      <header className="party-heading">
        <div>
          <h3>La compagnia</h3>
          <p>Compagni di viaggio, ricordi e ciò che sai di loro.</p>
        </div>
        <button
          className="primary"
          disabled={busy || pending || !!draft || confirm}
          onClick={() => void move(() => setDraft({ ...empty }))}
        >
          Aggiungi membro
        </button>
      </header>
      <p className="editor-hint">
        Ogni membro usa la sua pagina del Codex: appunti, immagini e
        collegamenti restano gli stessi. Una voce raccontata da un compagno
        rimane una sua affermazione.
      </p>
      {error ? (
        <div role="alert" className="error">
          {error}
          <button
            disabled={pending || !!draft}
            onClick={() => {
              setLoading(true);
              setAttempt((n) => n + 1);
            }}
          >
            Ricarica party
          </button>
        </div>
      ) : null}
      {loading ? <p role="status">Caricamento party…</p> : null}
      {draft ? (
        <form
          className="party-form"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <h4>
            {draft.revision === null
              ? "Aggiungi un compagno"
              : "Modifica membro"}
          </h4>
          {draft.revision === null ? (
            <label>
              Pagina del personaggio
              <select
                value={draft.pageId ?? ""}
                disabled={pending}
                onChange={(e) =>
                  setDraft({ ...draft, pageId: e.target.value || null })
                }
              >
                <option value="">Crea un nuovo personaggio</option>
                {pages
                  .filter(
                    (p) =>
                      p.kind === "npc" &&
                      !members.some((m) => m.page.id === p.id),
                  )
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
              </select>
            </label>
          ) : null}
          {!draft.pageId ? (
            <label>
              Nome del personaggio
              <input
                autoFocus
                required
                maxLength={200}
                value={draft.name}
                disabled={pending}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
          ) : null}
          <label>
            Giocatore (facoltativo)
            <input
              maxLength={200}
              value={draft.playerName}
              disabled={pending}
              onChange={(e) =>
                setDraft({ ...draft, playerName: e.target.value })
              }
            />
          </label>
          <label>
            Ruolo nella compagnia
            <input
              maxLength={500}
              value={draft.role}
              disabled={pending}
              onChange={(e) => setDraft({ ...draft, role: e.target.value })}
            />
          </label>
          <label>
            Presenza
            <select
              value={draft.status}
              disabled={pending}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  status: e.target.value as Member["status"],
                })
              }
            >
              {Object.entries(states).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <div className="actions">
            <button className="primary" disabled={pending}>
              Salva membro
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setDraft(null)}
            >
              Annulla
            </button>
          </div>
        </form>
      ) : null}
      {!loading && !members.length && !draft ? (
        <div className="empty">
          <h4>Chi viaggia con te?</h4>
          <p>
            Aggiungi un membro o collega un personaggio già presente nel Codex.
          </p>
        </div>
      ) : null}
      <div className="party-layout">
        <nav aria-label="Membri del party">
          {members.map((m) => (
            <button
              key={m.page.id}
              aria-current={m.page.id === selectedId ? "page" : undefined}
              disabled={busy || pending || !!draft || confirm}
              onClick={() => void move(() => setSelectedId(m.page.id))}
            >
              <strong>{m.page.title}</strong>
              <span>{m.role || "Ruolo da annotare"}</span>
              <small>
                {states[m.status]}
                {m.playerName ? ` · ${m.playerName}` : ""}
              </small>
            </button>
          ))}
        </nav>
        {selected && page && !draft ? (
          <div className="party-member">
            <header>
              <h4>{page.title}</h4>
              <p>
                {selected.role}{" "}
                {selected.playerName ? `· ${selected.playerName}` : ""}
              </p>
              <div className="actions">
                <button
                  disabled={busy || pending || confirm}
                  onClick={() => void move(() => onOpen(page))}
                >
                  Apri nel Codex
                </button>
                <button
                  disabled={busy || pending || confirm}
                  onClick={() =>
                    void move(() =>
                      setDraft({
                        pageId: page.id,
                        name: page.title,
                        playerName: selected.playerName,
                        role: selected.role,
                        status: selected.status,
                        revision: selected.revision,
                      }),
                    )
                  }
                >
                  Modifica membro
                </button>
                <button
                  disabled={busy || pending || confirm}
                  onClick={() => void move(() => setConfirm(true))}
                >
                  Rimuovi dal party
                </button>
              </div>
            </header>
            {confirm ? (
              <div
                role="alertdialog"
                aria-modal="true"
                aria-label="Rimuovere il membro dal party?"
                onKeyDown={(e) => {
                  if (e.key === "Escape" && !pending) setConfirm(false);
                  if (e.key === "Tab") {
                    const buttons =
                      e.currentTarget.querySelectorAll<HTMLButtonElement>(
                        "button:not(:disabled)",
                      );
                    if (
                      buttons.length &&
                      ((e.shiftKey && document.activeElement === buttons[0]) ||
                        (!e.shiftKey &&
                          document.activeElement ===
                            buttons[buttons.length - 1]))
                    ) {
                      e.preventDefault();
                      (e.shiftKey
                        ? buttons[buttons.length - 1]
                        : buttons[0]
                      ).focus();
                    }
                  }
                }}
              >
                <p>
                  La pagina del Codex, gli appunti, le immagini e i collegamenti
                  saranno conservati.
                </p>
                <button
                  autoFocus
                  disabled={pending}
                  onClick={() => setConfirm(false)}
                >
                  Annulla rimozione
                </button>
                <button disabled={pending} onClick={() => void remove()}>
                  Conferma rimozione
                </button>
              </div>
            ) : null}
            <h4>Quello che so</h4>
            <Suspense fallback={<p>Caricamento appunti…</p>}>
              <Editor
                key={page.id}
                page={page}
                onSaved={(p: KnowledgePage) => {
                  onSaved(p);
                  setMembers((v) =>
                    v.map((m) => (m.page.id === p.id ? { ...m, page: p } : m)),
                  );
                }}
                register={registerEditor}
                disabled={busy || pending || confirm}
              />
              <ImageGallery
                campaignId={campaignId}
                target={{ kind: "page", id: page.id }}
                busy={busy || pending || confirm}
              />
            </Suspense>
          </div>
        ) : null}
      </div>
    </section>
  );
}
