import { useEffect, useRef, useState } from "react";
import { tr } from "../../i18n/store";
import { useReducedMotion } from "../dice/useReducedMotion";
import type { Announcement } from "./api";
import { playFanfare } from "./fanfare";
import { heraldArt } from "./heraldArt";
import "./herald.css";

/** Geometric stand-in until the raster herald is installed: no fake figure. */
function TrumpetEmblem() {
  return (
    <svg className="herald-emblem" viewBox="0 0 240 240" focusable="false">
      <g className="herald-waves">
        <path d="M188 70c14 10 22 26 22 44" />
        <path d="M200 52c22 16 34 40 34 66" />
      </g>
      <g className="herald-trumpet">
        <path
          className="trumpet-bell"
          d="M150 92L214 56L222 70L226 90L222 110L214 126L150 104Z"
        />
        <path className="trumpet-tube" d="M34 96H152V100H34Z" />
        <path className="trumpet-loop" d="M70 98c0-14 40-14 40 0s-40 14-40 0" />
        <path className="trumpet-mouth" d="M22 92h12v12H22Z" />
        <g className="herald-pennant">
          <path d="M60 100V176L84 160L108 176V100Z" />
          <path
            className="pennant-mark"
            d="M84 118L89 133L104 138L89 143L84 158L79 143L64 138L79 133Z"
          />
        </g>
      </g>
    </svg>
  );
}
export default function HeraldAnnouncement({
  announcement,
  onUpdate,
  onLater,
  onDismiss,
  onSound,
}: {
  announcement: Announcement;
  onUpdate: () => void;
  onLater: () => void;
  onDismiss: () => void;
  onSound: (enabled: boolean) => Promise<void>;
}) {
  const { offer } = announcement;
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const reduced = useReducedMotion();
  const [settled, setSettled] = useState(false);
  const [sound, setSound] = useState(announcement.sound);
  const [blocked, setBlocked] = useState(false);
  const played = useRef(false);
  useEffect(() => {
    const node = dialog.current;
    const opener = document.activeElement;
    if (node && !node.open) node.showModal();
    heading.current?.focus();
    const timer = window.setTimeout(() => setSettled(true), 1600);
    return () => {
      window.clearTimeout(timer);
      if (node?.open) node.close();
      // Give focus back to whatever the user was doing before the herald.
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);
  useEffect(() => {
    if (played.current || !announcement.sound) return;
    played.current = true;
    void playFanfare().then((ok) => {
      if (!ok) setBlocked(true);
    });
  }, [announcement.sound]);
  const still = reduced || settled;
  return (
    <dialog
      ref={dialog}
      className={`herald${heraldArt.herald ? " herald-illustrated" : ""}${still ? " herald-still" : ""}`}
      aria-labelledby="herald-title"
      aria-describedby="herald-summary"
      onCancel={(event) => {
        event.preventDefault();
        onLater();
      }}
    >
      <div className="herald-stage" aria-hidden="true">
        {heraldArt.herald ? (
          <img className="herald-figure" src={heraldArt.herald} alt="" />
        ) : (
          <TrumpetEmblem />
        )}
      </div>
      <article
        className={`herald-manifesto${heraldArt.manifesto ? " herald-scroll" : ""}`}
        style={
          heraldArt.manifesto
            ? { backgroundImage: `url(${heraldArt.manifesto})` }
            : undefined
        }
      >
        <h2 id="herald-title" ref={heading} tabIndex={-1}>
          {tr("Chronexus {0} is available", [offer.version])}
        </h2>
        <p id="herald-summary">
          {tr(
            "The herald brings news of a new signed version. You can update now, ask for a reminder, or skip this version.",
          )}
        </p>
        <h3>{tr("What's new")}</h3>
        {offer.notes ? (
          <pre className="update-notes herald-notes">{offer.notes}</pre>
        ) : (
          <p>{tr("No release notes available.")}</p>
        )}
        <p className="herald-safety">
          {tr(
            "«Update» opens the settings and downloads the package, verifying its signature. Installation starts only when you confirm, after a verified backup of all campaigns.",
          )}
        </p>
        <div className="actions">
          <button className="primary" onClick={onUpdate}>
            {tr("Update")}
          </button>
          <button onClick={onLater}>{tr("Remind me later")}</button>
          <button onClick={onDismiss}>{tr("Ignore this version")}</button>
        </div>
        <div className="herald-controls">
          <button
            aria-pressed={sound}
            onClick={() => {
              const next = !sound;
              setSound(next);
              void onSound(next).catch(() => setSound(!next));
              if (next) void playFanfare().then((ok) => setBlocked(!ok));
            }}
          >
            {sound ? tr("Trumpet sound: on") : tr("Trumpet sound: off")}
          </button>
          {!still ? (
            <button onClick={() => setSettled(true)}>
              {tr("Skip animation")}
            </button>
          ) : null}
        </div>
        {blocked && sound ? (
          <p className="muted">
            {tr(
              "The system did not allow automatic audio. The announcement is complete even without sound.",
            )}
          </p>
        ) : null}
      </article>
    </dialog>
  );
}
