import { useCallback, useEffect, useState } from "react";
import { heraldApi, type Announcement, type HeraldChoice } from "./api";

export const STARTUP_DELAY_MS = 6000;
export const IDLE_POLL_MS = 2000;
const TEXT_INPUTS = [
  "text",
  "search",
  "url",
  "email",
  "number",
  "password",
  "tel",
];
/** True while the user is typing somewhere: the herald must not steal focus. */
export function editing(element: Element | null) {
  if (!(element instanceof HTMLElement)) return false;
  if (element.isContentEditable || element.tagName === "TEXTAREA") return true;
  // Selects, checkboxes and buttons hold focus without the user typing.
  return (
    element instanceof HTMLInputElement && TEXT_INPUTS.includes(element.type)
  );
}
/**
 * One automatic check after the interface starts (the backend applies opt-out
 * and rate limit), then waits until the app is idle before announcing.
 */
export function useStartupHerald(canShow: () => boolean) {
  const [pending, setPending] = useState<Announcement | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      heraldApi
        .startupCheck()
        .then((found) => {
          if (active && found) setPending(found);
        })
        .catch(() => undefined);
    }, STARTUP_DELAY_MS);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, []);
  useEffect(() => {
    if (!pending || visible) return;
    let active = true;
    const idle = () =>
      canShow() &&
      document.visibilityState !== "hidden" &&
      !editing(document.activeElement) &&
      !document.querySelector(
        'dialog[open], [role="dialog"], [role="alertdialog"]',
      );
    const poll = window.setInterval(() => {
      if (!idle()) return;
      heraldApi
        .blocked()
        .then((blocked) => {
          // The user may have started writing while the check was running.
          if (active && !blocked && idle()) setVisible(true);
        })
        .catch(() => undefined);
    }, IDLE_POLL_MS);
    return () => {
      active = false;
      window.clearInterval(poll);
    };
  }, [pending, visible, canShow]);
  const close = useCallback(
    (choice: HeraldChoice | null) => {
      if (pending && choice)
        void heraldApi
          .record(pending.offer.version, choice)
          .catch(() => undefined);
      setVisible(false);
      setPending(null);
    },
    [pending],
  );
  return { announcement: visible ? pending : null, close };
}
