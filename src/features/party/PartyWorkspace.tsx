import { localizeLabels } from "../../i18n/store";
import { tr } from "../../i18n/store";
import { Text } from "../../i18n/Text";
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
const states = localizeLabels({
  active: "In the party",
  former: "Former member",
  unknown: "To clarify",
});
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
            tr("Save or cancel the party changes before changing view."),
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
    <section className="party-workspace" aria-label={tr("Campaign party")}>
      <header className="party-heading">
        <div>
          <h3>
            <Text source={"The company"} />
          </h3>
          <p>
            <Text
              source={
                "Travel companions, memories and what you know about them."
              }
            />
          </p>
        </div>
        <button
          className="primary"
          disabled={busy || pending || !!draft || confirm}
          onClick={() => void move(() => setDraft({ ...empty }))}
        >
          <Text source={"Add member"} />
        </button>
      </header>
      <p className="editor-hint">
        <Text
          source={
            "Each member uses their own Codex page: notes, images and links stay the same. An entry told by a companion remains their claim."
          }
        />
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
            <Text source={"Reload party"} />
          </button>
        </div>
      ) : null}
      {loading ? (
        <p role="status">
          <Text source={"Loading party…"} />
        </p>
      ) : null}
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
              ? tr("Add a companion")
              : tr("Edit member")}
          </h4>
          {draft.revision === null ? (
            <label>
              <Text source={"Character page"} />
              <select
                value={draft.pageId ?? ""}
                disabled={pending}
                onChange={(e) =>
                  setDraft({ ...draft, pageId: e.target.value || null })
                }
              >
                <option value="">{tr("Create a new character")}</option>
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
              <Text source={"Character name"} />
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
            <Text source={"Player (optional)"} />
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
            <Text source={"Role in the company"} />
            <input
              maxLength={500}
              value={draft.role}
              disabled={pending}
              onChange={(e) => setDraft({ ...draft, role: e.target.value })}
            />
          </label>
          <label>
            <Text source={"Presence"} />
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
              <Text source={"Save member"} />
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setDraft(null)}
            >
              <Text source={"Cancel"} />
            </button>
          </div>
        </form>
      ) : null}
      {!loading && !members.length && !draft ? (
        <div className="empty">
          <h4>
            <Text source={"Who travels with you?"} />
          </h4>
          <p>
            <Text
              source={"Add a member or link a character already in the Codex."}
            />
          </p>
        </div>
      ) : null}
      <div className="party-layout">
        <nav aria-label={tr("Party members")}>
          {members.map((m) => (
            <button
              key={m.page.id}
              aria-current={m.page.id === selectedId ? "page" : undefined}
              disabled={busy || pending || !!draft || confirm}
              onClick={() => void move(() => setSelectedId(m.page.id))}
            >
              <strong>{m.page.title}</strong>
              <span>{m.role || tr("Role to note")}</span>
              <small>
                {states[m.status]}
                {m.playerName ? tr(" · {0}", [m.playerName]) : ""}
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
                {selected.playerName ? tr("· {0}", [selected.playerName]) : ""}
              </p>
              <div className="actions">
                <button
                  disabled={busy || pending || confirm}
                  onClick={() => void move(() => onOpen(page))}
                >
                  <Text source={"Open in Codex"} />
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
                  <Text source={"Edit member"} />
                </button>
                <button
                  disabled={busy || pending || confirm}
                  onClick={() => void move(() => setConfirm(true))}
                >
                  <Text source={"Remove from the party"} />
                </button>
              </div>
            </header>
            {confirm ? (
              <div
                role="alertdialog"
                aria-modal="true"
                aria-label={tr("Remove the member from the party?")}
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
                  <Text
                    source={
                      "The Codex page, notes, images and links will be kept."
                    }
                  />
                </p>
                <button
                  autoFocus
                  disabled={pending}
                  onClick={() => setConfirm(false)}
                >
                  <Text source={"Cancel removal"} />
                </button>
                <button disabled={pending} onClick={() => void remove()}>
                  <Text source={"Confirm removal"} />
                </button>
              </div>
            ) : null}
            <h4>
              <Text source={"What I know"} />
            </h4>
            <Suspense
              fallback={
                <p>
                  <Text source={"Loading notes…"} />
                </p>
              }
            >
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
