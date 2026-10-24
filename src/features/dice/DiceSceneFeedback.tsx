import type { Phase } from "./useDiceTimeline";
import type { DragonOutcome } from "./outcome";
import { diceText as t } from "./strings";
export default function DiceSceneFeedback({
  phase,
  reduced,
  animate,
  finish,
  revealed,
  outcome,
  count,
  shown,
}: {
  phase: Phase;
  reduced: boolean;
  animate: boolean;
  finish: () => void;
  revealed: boolean;
  outcome: DragonOutcome;
  count: number;
  shown: number;
}) {
  return (
    <>
      {" "}
      <div className="dice-scene-status">
        <p role="status">
          {phase === "finished" ? (reduced ? t.reduced : t.saved) : t[phase]}
        </p>
        {animate && phase !== "finished" ? (
          <button type="button" onClick={finish}>
            {t.skip}
          </button>
        ) : null}
      </div>
      {revealed && outcome !== "ordinary" ? (
        <p className={`dice-outcome outcome-${outcome}`} role="status">
          {outcome === "celebration" ? t.best : t.worst}
        </p>
      ) : null}
      {count > shown ? (
        <p className="editor-hint">{t.compact(shown, count)}</p>
      ) : null}
    </>
  );
}
