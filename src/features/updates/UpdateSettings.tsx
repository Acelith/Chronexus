import { useEffect, useRef, useState } from "react";
import "./herald.css";
import { tr } from "../../i18n/store";
import { errorMessage } from "../journal/api";
import {
  heraldApi,
  updatesApi,
  type HeraldSettings,
  type UpdateOffer,
  type UpdateOverview,
  type UpdateProgress,
} from "./api";
interface Props {
  busy: boolean;
  run: (action: () => Promise<void>) => Promise<unknown>;
  /** Offer accepted from the herald: download starts, install stays explicit. */
  initialOffer?: UpdateOffer | null;
  onHandoffUsed?: () => void;
}
export default function UpdateSettings({
  busy,
  run,
  initialOffer,
  onHandoffUsed,
}: Props) {
  const [overview, setOverview] = useState<UpdateOverview | null>(null);
  const [endpoint, setEndpoint] = useState("");
  const [offer, setOffer] = useState<UpdateOffer | null>(null);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [progress, setProgress] = useState<UpdateProgress | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    void updatesApi
      .overview()
      .then((value) => {
        if (active) {
          setOverview(value);
          setEndpoint(value.settings.endpoint);
        }
      })
      .catch((reason) => {
        if (active) setError(errorMessage(reason));
      });
    return () => {
      active = false;
    };
  }, []);
  const [herald, setHerald] = useState<HeraldSettings | null>(null);
  useEffect(() => {
    let active = true;
    heraldApi
      .settings()
      .then((value) => {
        if (active) setHerald(value);
      })
      .catch((reason) => {
        if (active) setError(errorMessage(reason));
      });
    return () => {
      active = false;
    };
  }, []);
  const handoff = useRef<string | null>(null);
  useEffect(() => {
    if (!initialOffer || busy || handoff.current === initialOffer.id) return;
    handoff.current = initialOffer.id;
    onHandoffUsed?.();
    // The user already chose «Aggiorna» in the herald: start the verified download.
    void perform("download", async () => {
      setOffer(initialOffer);
      setReady(false);
      setProgress(null);
      await updatesApi.download(initialOffer.id, setProgress);
      setReady(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialOffer, busy]);
  async function perform(phase: string, action: () => Promise<void>) {
    if (pending || busy) return;
    setPending(phase);
    setError("");
    setNotice("");
    try {
      await run(async () => {
        try {
          await action();
        } catch (reason) {
          setError(errorMessage(reason));
          setProgress(null);
        }
      });
    } finally {
      setPending(null);
    }
  }
  const disabled = !!pending || busy;
  const changed = endpoint !== overview?.settings.endpoint;
  const labels: Record<string, string> = {
    download: tr("Downloading…"),
    verify: tr("Verifying the signature…"),
    ready: tr("Package verified, ready to install."),
    backup: tr("Creating and verifying the backup…"),
    install: tr("Starting installation…"),
  };
  return (
    <section className="language-settings" aria-label={tr("App updates")}>
      <h3>{tr("App updates")}</h3>
      <p>
        {tr(
          "Check for new Chronexus versions. Downloading needs no account and sends no campaign data.",
        )}
      </p>
      {overview ? (
        <p>
          {tr("Installed version")}: <strong>{overview.currentVersion}</strong>
        </p>
      ) : !error ? (
        <p role="status">{tr("Reading settings…")}</p>
      ) : null}
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? <p role="status">{notice}</p> : null}
      {overview ? (
        <>
          <div className="actions">
            <button
              disabled={disabled || changed}
              onClick={() =>
                void perform("check", async () => {
                  setOffer(null);
                  setReady(false);
                  setProgress(null);
                  const next = await updatesApi.check();
                  setOffer(next);
                  if (!next)
                    setNotice(
                      tr("Chronexus is up to date. No new version available."),
                    );
                })
              }
            >
              {pending === "check" ? tr("Checking…") : tr("Check for updates")}
            </button>
          </div>
          {offer ? (
            <div>
              <h4>
                {tr("New version available")}: {offer.version}
              </h4>
              {offer.notes ? (
                <pre className="update-notes">{offer.notes}</pre>
              ) : (
                <p>{tr("No release notes available.")}</p>
              )}
              <p>
                {tr(
                  "Before installing, a verified backup of all campaigns is created, with managed images and attachments. If the backup fails, the update stops.",
                )}
              </p>
              <p>
                {tr(
                  "The app will close to install the update. Reopen Chronexus when it finishes. The AI runtime and weights are not replaced.",
                )}
              </p>
              <div className="actions">
                {!ready ? (
                  <button
                    className="primary"
                    disabled={disabled || changed}
                    onClick={() =>
                      void perform("download", async () => {
                        setProgress(null);
                        await updatesApi.download(offer.id, setProgress);
                        setReady(true);
                      })
                    }
                  >
                    {tr("Download update")}
                  </button>
                ) : (
                  <button
                    className="primary"
                    disabled={disabled || changed}
                    onClick={() =>
                      void perform("install", async () => {
                        const path = await updatesApi.install(
                          offer.id,
                          setProgress,
                        );
                        setNotice(
                          `${tr("Update installed. Reopen Chronexus. Backup:")} ${path}`,
                        );
                        setOffer(null);
                        setReady(false);
                      })
                    }
                  >
                    {tr("Create backup and install")}
                  </button>
                )}
                {pending === "download" ? (
                  <button
                    onClick={() =>
                      void updatesApi
                        .cancel()
                        .catch((reason) => setError(errorMessage(reason)))
                    }
                  >
                    {tr("Cancel download")}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
          {progress ? (
            <div aria-live="polite">
              <p role="status">
                {labels[progress.phase] ?? tr("Operation in progress…")}
              </p>
              {progress.phase === "download" ? (
                <>
                  <progress
                    aria-label={tr("Update download")}
                    max={progress.total ?? undefined}
                    value={progress.total ? progress.downloaded : undefined}
                  />
                  <p>
                    {(progress.downloaded / 1024 / 1024).toFixed(1)} MiB
                    {progress.total
                      ? ` / ${(progress.total / 1024 / 1024).toFixed(1)} MiB`
                      : ""}
                  </p>
                </>
              ) : null}
              {progress.backupPath ? (
                <p>
                  {tr("Backup saved in")}: <bdi>{progress.backupPath}</bdi>
                </p>
              ) : null}
              {progress.backupNotice ? (
                <p role="alert">{progress.backupNotice}</p>
              ) : null}
            </div>
          ) : null}
          {herald ? (
            <fieldset className="herald-settings" disabled={disabled}>
              <legend>{tr("New version announcements")}</legend>
              {(
                [
                  [
                    "startupCheck",
                    tr(
                      "Check once at startup (at most every 20 hours) and announce new versions with the herald",
                    ),
                  ],
                  ["sound", tr("Sound the trumpet when the herald appears")],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={herald[key]}
                    onChange={(event) => {
                      const next = { ...herald, [key]: event.target.checked };
                      void perform("herald", async () => {
                        setHerald(await heraldApi.save(next));
                        setNotice(tr("Announcement preferences saved."));
                      });
                    }}
                  />
                  {label}
                </label>
              ))}
              <p className="muted">
                {tr(
                  "The automatic check contacts only the update channel, never the wikis or AI models, and sends no campaign data. The manual check is always available.",
                )}
              </p>
            </fieldset>
          ) : null}
          <p>
            {tr(
              "Backups made before updates are kept here and never deleted automatically:",
            )}
          </p>
          <p className="update-path">
            <bdi>{overview.backupDirectory}</bdi>
          </p>
          <details>
            <summary>{tr("Update server")}</summary>
            <p>
              {tr(
                "Use the public API of the latest Forgegit release or a latest.json manifest on your HTTPS server. Only packages signed by Chronexus on the same server are accepted.",
              )}
            </p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void perform("settings", async () => {
                  const settings = await updatesApi.save({ endpoint });
                  setOverview({ ...overview, settings });
                  setEndpoint(settings.endpoint);
                  setOffer(null);
                  setReady(false);
                  setProgress(null);
                  setNotice(tr("Update channel saved."));
                });
              }}
            >
              <label>
                {tr("Update channel address")}
                <input
                  type="url"
                  required
                  maxLength={2048}
                  value={endpoint}
                  disabled={disabled}
                  onChange={(event) => setEndpoint(event.target.value)}
                  dir="ltr"
                />
              </label>
              <button disabled={disabled || !changed}>
                {tr("Save update channel")}
              </button>
              {changed ? (
                <p>
                  {tr(
                    "Save the channel before checking for or installing updates.",
                  )}
                </p>
              ) : null}
            </form>
          </details>
        </>
      ) : (
        <button
          disabled={disabled}
          onClick={() =>
            void perform("load", async () => {
              const value = await updatesApi.overview();
              setOverview(value);
              setEndpoint(value.settings.endpoint);
            })
          }
        >
          {tr("Reload update settings")}
        </button>
      )}
    </section>
  );
}
