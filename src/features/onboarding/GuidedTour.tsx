import { useEffect, useRef, useState } from "react";
import { Text } from "../../i18n/Text";
import { localizeLabels, tr } from "../../i18n/store";
import "./onboarding.css";

const steps: [string, string][] = localizeLabels([
  [
    "Welcome to Chronexus",
    "A journal for the player, not the game master. Everything stays on this computer unless you choose to share it.",
  ],
  [
    "Journal",
    "Write one page per game session. Type [[ to mention a person, place or item from the Codex.",
  ],
  [
    "Codex",
    "A page for everything your character has met. Mentions and backlinks connect each page to your notes.",
  ],
  [
    "Graph",
    "Relationships you record yourself, each with a certainty: confirmed, suspected, disproven or unknown. A mention alone never becomes a fact.",
  ],
  [
    "Clue board",
    "Open questions, leads, suspicions and rumours, linked to the note where you heard them.",
  ],
  [
    "Character",
    "Your sheet, inventory and spells. The values are whatever you enter; nothing is calculated for you.",
  ],
  [
    "Backups and settings",
    "Back up from the side menu. The language, the demo campaign and this tour are in App settings.",
  ],
]);

/**
 * M32 first-start tour: a modal dialog, fully keyboard operable. Escape or "Skip tour"
 * closes it; either way it counts as seen and reopens only from App settings.
 */
export default function GuidedTour({
  onClose,
}: {
  onClose: (completed: boolean) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [step, setStep] = useState(0);
  useEffect(() => {
    const node = dialog.current;
    if (node && !node.open) node.showModal?.();
    return () => node?.close?.();
  }, []);
  useEffect(() => {
    heading.current?.focus();
  }, [step]);
  const [title, body] = steps[step];
  const last = step === steps.length - 1;
  return (
    <dialog
      ref={dialog}
      className="confirm-dialog guided-tour"
      aria-labelledby="tour-title"
      aria-describedby="tour-body"
      onCancel={(event) => {
        event.preventDefault();
        onClose(false);
      }}
    >
      <p className="tour-progress" aria-live="polite">
        {tr("Step {0} of {1}", [step + 1, steps.length])}
      </p>
      <h4 id="tour-title" ref={heading} tabIndex={-1}>
        {title}
      </h4>
      <p id="tour-body">{body}</p>
      <ol className="tour-dots" aria-hidden="true">
        {steps.map(([name], index) => (
          <li key={name} className={index === step ? "current" : undefined} />
        ))}
      </ol>
      <div className="actions">
        <button type="button" onClick={() => onClose(false)}>
          <Text source={"Skip tour"} />
        </button>
        <span className="tour-spacer" />
        <button
          type="button"
          disabled={step === 0}
          onClick={() => setStep((value) => value - 1)}
        >
          <Text source={"Back"} />
        </button>
        <button
          type="button"
          className="primary"
          onClick={() => (last ? onClose(true) : setStep((value) => value + 1))}
        >
          {last ? tr("Finish") : tr("Next")}
        </button>
      </div>
    </dialog>
  );
}
