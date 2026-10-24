import { useCallback, useEffect, useRef, useState } from "react";
import type { SaveGuard } from "../journal/Editor";
import { errorMessage } from "../journal/api";
import { diceApi, type Roll } from "./api";
import { emptyQuantities, selections, composition } from "./model";
import { diceText as t } from "./strings";
export function useDiceRoller(
  campaignId: string,
  register: (guard: SaveGuard | null) => void,
  busy: boolean,
  onSaved: (roll: Roll) => void,
) {
  const [quantities, setQuantities] = useState(emptyQuantities),
    [current, setCurrent] = useState<Roll | null>(null),
    [pending, setPending] = useState(false),
    [animating, setAnimating] = useState(false),
    [error, setError] = useState("");
  const request = useRef<{ id: string; composition: string } | null>(null),
    pendingTask = useRef<Promise<void> | null>(null),
    inAnimation = useRef(false);
  useEffect(() => {
    register({
      flush: async () => {
        await pendingTask.current;
      },
      dirty: () => pendingTask.current !== null,
    });
    return () => register(null);
  }, [register]);
  const done = useCallback(() => {
    inAnimation.current = false;
    setAnimating(false);
  }, []);
  function submit() {
    if (pendingTask.current || inAnimation.current || busy) return;
    let groups;
    try {
      groups = selections(quantities);
    } catch (reason) {
      setError(errorMessage(reason));
      return;
    }
    const signature = composition(groups);
    if (!request.current || request.current.composition !== signature)
      request.current = { id: crypto.randomUUID(), composition: signature };
    setPending(true);
    setError("");
    const task = diceApi
      .roll(campaignId, request.current.id, groups)
      .then((saved) => {
        setQuantities(emptyQuantities());
        request.current = null;
        setCurrent(saved);
        inAnimation.current = true;
        setAnimating(true);
        onSaved(saved);
      })
      .catch((reason) => {
        setError(`${errorMessage(reason)} ${t.notConfirmed}`);
        throw reason;
      })
      .finally(() => {
        setPending(false);
        pendingTask.current = null;
      });
    pendingTask.current = task;
    void task.catch(() => {});
  }
  return {
    quantities,
    setQuantities,
    current,
    pending,
    animating,
    error,
    done,
    submit,
    review: (roll: Roll) => {
      setCurrent(roll);
      done();
    },
  };
}
