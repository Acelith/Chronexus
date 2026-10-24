import { diceText as t } from "./strings";
import DiceSceneFeedback from "./DiceSceneFeedback";
import { dragonOutcome } from "./outcome";
import LivingDragons from "./LivingDragons";
import "./dragons.css";
import { useDiceTimeline } from "./useDiceTimeline";
import type { Roll } from "./api";
import { sceneDice } from "./model";
import { useReducedMotion } from "./useReducedMotion";
import DiceCast from "./DiceCast";
import SlotNumber from "./SlotNumber";
const dragons = new URL("../../../assets/dice/dragons.webp", import.meta.url)
  .href;
const fire = new URL("../../../assets/dice/fire.webp", import.meta.url).href;
export function EmptyScene() {
  return (
    <div className="dice-scene empty-scene">
      <img className="dragon-ring" src={dragons} alt="" />
      <div className="dice-scene-empty">
        <h3>{t.empty}</h3>
        <p>{t.emptyHint}</p>
      </div>
    </div>
  );
}
export default function DiceScene({
  roll,
  animate,
  onDone,
}: {
  roll: Roll;
  animate: boolean;
  onDone: () => void;
}) {
  const reduced = useReducedMotion();
  const outcome = dragonOutcome(roll);
  const { phase, finish } = useDiceTimeline(
    animate,
    reduced,
    onDone,
    outcome !== "ordinary",
  );
  const reacting =
    animate && !reduced && phase === "reveal" && outcome !== "ordinary";
  const dice = sceneDice(roll),
    count = roll.groups.reduce((sum, g) => sum + g.quantity, 0);
  const revealed = phase === "reveal" || phase === "finished" || reduced;
  return (
    <div className="dice-scene-container">
      <div
        className={`dice-scene phase-${phase} ${reduced ? "motion-reduced" : ""} ${reacting ? "reaction-active" : ""}`}
        data-phase={phase}
        data-outcome={revealed ? outcome : "pending"}
        data-roll-id={roll.id}
        aria-hidden="true"
      >
        <img className="dragon-ring" src={dragons} alt="" />
        {reacting ? (
          <LivingDragons outcome={outcome as "celebration" | "threat"} />
        ) : null}
        <DiceCast
          dice={dice}
          revealed={revealed}
          animate={!reduced && phase === "reveal"}
        />
        <img className="dragon-fire" src={fire} alt="" />
        {revealed ? (
          <div className="scene-total">
            <span>{t.total}</span>
            <SlotNumber
              value={roll.total}
              animate={!reduced && phase === "reveal"}
            />
          </div>
        ) : null}
      </div>
      <DiceSceneFeedback
        phase={phase}
        reduced={reduced}
        animate={animate}
        finish={finish}
        revealed={revealed}
        outcome={outcome}
        count={count}
        shown={dice.length}
      />
    </div>
  );
}
