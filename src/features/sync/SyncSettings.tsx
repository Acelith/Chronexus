import { useEffect, useState, type FormEvent } from "react";
import { tr } from "../../i18n/store";
import { usePendingAction } from "../../usePendingAction";
import { syncApi, type SyncAccount } from "./api";

/** M24: sharing server and account; nothing is contacted without a click. */
export default function SyncSettings({ disabled }: { disabled: boolean }) {
  const [account, setAccount] = useState<SyncAccount | null>(null);
  const [server, setServer] = useState("");
  const [mode, setMode] = useState<"signin" | "invite">("signin");
  const [form, setForm] = useState({
    code: "",
    username: "",
    displayName: "",
    password: "",
    device: "Chronexus desktop",
  });
  const { pending, error, notice, setError, perform } = usePendingAction();
  useEffect(() => {
    let active = true;
    syncApi
      .account()
      .then((value) => {
        if (!active) return;
        setAccount(value);
        setServer(value.server ?? "");
      })
      .catch((reason: Error) => {
        if (active) setError(reason.message);
      });
    return () => {
      active = false;
    };
  }, [setError]);
  const busy = pending || disabled;
  const field = (key: keyof typeof form) => ({
    value: form[key],
    disabled: busy,
    onChange: (event: { target: { value: string } }) =>
      setForm((current) => ({ ...current, [key]: event.target.value })),
  });
  function submitServer(event: FormEvent) {
    event.preventDefault();
    void perform(
      async () => {
        const saved = await syncApi.setServer(server);
        setAccount(saved);
        return tr("Server verified and saved: {0}.", [saved.server ?? ""]);
      },
      { blocked: disabled },
    );
  }
  function submitAccount(event: FormEvent) {
    event.preventDefault();
    void perform(
      async () => {
        const saved =
          mode === "signin"
            ? await syncApi.signIn(form.username, form.password, form.device)
            : await syncApi.redeem(
                form.code,
                form.username,
                form.displayName,
                form.password,
                form.device,
              );
        setAccount(saved);
        setForm((current) => ({ ...current, password: "", code: "" }));
        return tr("Signed in as {0}.", [saved.displayName ?? ""]);
      },
      { blocked: disabled },
    );
  }
  return (
    <section
      className="language-settings sync-settings"
      aria-label={tr("Campaign sharing")}
    >
      <h3>{tr("Campaign sharing")}</h3>
      <p>
        {tr(
          "Optional. Chronexus works offline as before; a self-hosted Chronexus server is contacted only when you press a button here or in a campaign's Sharing view. Only the items you mark as shared are sent; private notes, sheets, AI data and preferences stay on this device.",
        )}
      </p>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      <p role="status">{pending ? tr("Contacting the server…") : notice}</p>
      {!account && !error ? (
        <p role="status">{tr("Reading settings…")}</p>
      ) : null}
      {account ? (
        <>
          <form onSubmit={submitServer}>
            <label>
              {tr("Server address (HTTPS)")}
              <input
                type="url"
                required
                placeholder="https://sync.example.org"
                value={server}
                disabled={busy}
                onChange={(e) => setServer(e.target.value)}
              />
            </label>
            <button disabled={busy || !server.trim()}>
              {tr("Verify and save server")}
            </button>
          </form>
          {account.server && account.signedIn ? (
            <div className="sync-account">
              <p>
                {tr("Signed in to {0} as {1} ({2}).", [
                  account.server,
                  account.displayName ?? "",
                  account.username ?? "",
                ])}
              </p>
              <button
                disabled={busy}
                onClick={() =>
                  void perform(
                    async () => {
                      setAccount(await syncApi.signOut());
                      return tr(
                        "Signed out. Shared campaigns stay on this device.",
                      );
                    },
                    { blocked: disabled },
                  )
                }
              >
                {tr("Sign out")}
              </button>
            </div>
          ) : null}
          {account.server && !account.signedIn ? (
            <form onSubmit={submitAccount} className="sync-account">
              <fieldset disabled={busy}>
                <legend>{tr("Account")}</legend>
                <label>
                  <input
                    type="radio"
                    name="sync-mode"
                    checked={mode === "signin"}
                    onChange={() => setMode("signin")}
                  />
                  {tr("I have an account")}
                </label>
                <label>
                  <input
                    type="radio"
                    name="sync-mode"
                    checked={mode === "invite"}
                    onChange={() => setMode("invite")}
                  />
                  {tr("I have an invitation code")}
                </label>
              </fieldset>
              {mode === "invite" ? (
                <>
                  <label>
                    {tr("Invitation code")}
                    <input required autoComplete="off" {...field("code")} />
                  </label>
                  <label>
                    {tr("Name shown to other players")}
                    <input required maxLength={100} {...field("displayName")} />
                  </label>
                </>
              ) : null}
              <label>
                {tr("User name")}
                <input
                  required
                  maxLength={64}
                  autoComplete="username"
                  {...field("username")}
                />
              </label>
              <label>
                {tr("Password")}
                <input
                  required
                  type="password"
                  minLength={mode === "invite" ? 12 : 1}
                  autoComplete={
                    mode === "invite" ? "new-password" : "current-password"
                  }
                  {...field("password")}
                />
              </label>
              <label>
                {tr("Device name")}
                <input required maxLength={64} {...field("device")} />
              </label>
              <button className="primary" disabled={busy}>
                {mode === "signin"
                  ? tr("Sign in")
                  : tr("Create account with invitation")}
              </button>
              <p className="muted">
                {tr(
                  "The password is sent only to this server over HTTPS and is never stored; Chronexus keeps a session token outside campaign backups.",
                )}
              </p>
            </form>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
