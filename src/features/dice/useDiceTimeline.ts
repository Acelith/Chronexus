import { useCallback, useEffect, useRef, useState } from "react";
export type Phase = "rolling" | "landing" | "burn" | "reveal" | "finished";
export function useDiceTimeline(
  animate: boolean,
  reduced: boolean,
  onDone: () => void,
) {
  const [phase, setPhase] = useState<Phase>(
    animate && !reduced ? "rolling" : "finished",
  );
  const cancel = useRef(() => {});
  const finish = useCallback(() => {
    cancel.current();
    setPhase("finished");
    onDone();
  }, [onDone]);
  useEffect(() => {
    if (!animate) return;
    if (reduced) {
      const reveal = setTimeout(finish, 0);
      cancel.current = () => clearTimeout(reveal);
      return () => clearTimeout(reveal);
    }
    const landing = setTimeout(() => setPhase("landing"), 1000),
      burn = setTimeout(() => setPhase("burn"), 1150),
      reveal = setTimeout(() => setPhase("reveal"), 1650),
      complete = setTimeout(finish, 2500);
    cancel.current = () => {
      clearTimeout(landing);
      clearTimeout(burn);
      clearTimeout(reveal);
      clearTimeout(complete);
    };
    return () => {
      clearTimeout(landing);
      clearTimeout(burn);
      clearTimeout(reveal);
      clearTimeout(complete);
    };
  }, [animate, reduced, finish]);
  return { phase, finish };
}
