import { useEffect, useRef, useState } from "react";
import { editing } from "../updates/useStartupHerald";
import {
  BACKUP_STATUS_EVENT,
  backupFolderApi,
  type PeriodicOutcome,
} from "./api";

export const FIRST_CHECK_MS = 30_000;
export const CHECK_EVERY_MS = 60_000;
/** The user must have left keyboard and pointer alone this long. */
export const QUIET_MS = 45_000;
export const NOTICE_MS = 12_000;
/**
 * M19: periodic backups run only while the app is open and idle. The backend
 * decides whether one is due, so a check costs a file read, never a backup.
 */
export function usePeriodicBackup(canRun: () => boolean) {
  const [outcome, setOutcome] = useState<PeriodicOutcome | null>(null);
  const canRunRef = useRef(canRun);
  useEffect(() => {
    canRunRef.current = canRun;
  }, [canRun]);
  useEffect(() => {
    let lastActivity = Date.now();
    const touch = () => {
      lastActivity = Date.now();
    };
    const events = ["keydown", "pointerdown", "wheel", "input"] as const;
    for (const name of events)
      window.addEventListener(name, touch, { capture: true, passive: true });
    let running = false;
    const check = () => {
      if (
        running ||
        !canRunRef.current() ||
        Date.now() - lastActivity < QUIET_MS ||
        document.visibilityState === "hidden" ||
        editing(document.activeElement) ||
        document.querySelector(
          'dialog[open], [role="dialog"], [role="alertdialog"]',
        )
      )
        return;
      running = true;
      backupFolderApi
        .tick()
        .then((tick) => {
          if (tick.ran && tick.outcome) {
            setOutcome(tick.outcome);
            window.dispatchEvent(new Event(BACKUP_STATUS_EVENT));
          }
        })
        .catch(() => undefined)
        .finally(() => {
          running = false;
        });
    };
    let interval = 0;
    const first = window.setTimeout(() => {
      check();
      interval = window.setInterval(check, CHECK_EVERY_MS);
    }, FIRST_CHECK_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
      for (const name of events)
        window.removeEventListener(name, touch, { capture: true });
    };
  }, []);
  useEffect(() => {
    // Successes fade on their own; failures stay until dismissed.
    if (!outcome || outcome.error) return;
    const timer = window.setTimeout(() => setOutcome(null), NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [outcome]);
  return { outcome, dismiss: () => setOutcome(null) };
}
