import { useCallback, useRef, useState } from "react";
import { errorMessage } from "./features/journal/api";

/**
 * One action at a time for a settings or workspace panel: in-progress flag,
 * error and notice. The action may return the notice to show; failures are
 * reported through `error`, never thrown to the caller.
 */
export function usePendingAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const running = useRef(false);
  const perform = useCallback(
    async (
      action: () => Promise<string | void>,
      options: {
        /** Another app operation is running: ignore the request. */
        blocked?: boolean;
        /** Runs the action through the app's draft-flushing operation guard. */
        through?: (action: () => Promise<void>) => Promise<unknown>;
      } = {},
    ) => {
      if (running.current || options.blocked) return;
      running.current = true;
      setPending(true);
      setError("");
      setNotice("");
      const body = async () => {
        try {
          const message = await action();
          if (message) setNotice(message);
        } catch (reason) {
          setError(errorMessage(reason));
        }
      };
      try {
        await (options.through ? options.through(body) : body());
      } finally {
        running.current = false;
        setPending(false);
      }
    },
    [],
  );
  return { pending, error, notice, setError, setNotice, perform, running };
}
