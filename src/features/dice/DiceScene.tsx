import type { CSSProperties } from "react";
import { useDiceTimeline } from "./useDiceTimeline";
import type { Roll } from "./api";
import { sceneDice } from "./model";
import { diceText as t } from "./strings";
import { useReducedMotion } from "./useReducedMotion";
import DieFace from "./DieFace";
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
  const { phase, finish } = useDiceTimeline(animate, reduced, onDone);
  const dice = sceneDice(roll),
    count = roll.groups.reduce((sum, g) => sum + g.quantity, 0);
  const revealed = phase === "reveal" || phase === "finished" || reduced;
  return (
    <div className="dice-scene-container">
      <div
        className={`dice-scene phase-${phase} ${reduced ? "motion-reduced" : ""}`}
        data-phase={phase}
        data-roll-id={roll.id}
        aria-hidden="true"
      >
        <img className="dragon-ring" src={dragons} alt="" />
        <div
          style={
            {
              "--die-columns": Math.min(dice.length, dice.length > 9 ? 4 : 3),
            } as CSSProperties
          }
          className={`dice-stage ${dice.length === 1 ? "one-die" : ""} ${dice.length > 9 ? "many-dice" : dice.length > 6 ? "medium-dice" : ""}`}
        >
          {dice.map((die, index) => (
            <div
              key={die.key}
              className="thrown-die"
              style={
                {
                  "--die-delay": `${Math.min(index * 12, 120)}ms`,
                  "--die-turn": `${(index % 2 === 0 ? 1 : -1) * (520 + index * 37)}deg`,
                  "--die-x": `${((index % 3) - 1) * 90}px`,
                  "--die-y": `${-130 - (index % 4) * 15}px`,
                } as CSSProperties
              }
            >
              <div className="rolling-body">
                <DieFace sides={die.sides}>
                  {revealed ? (
                    <SlotNumber
                      value={die.value}
                      animate={!reduced && phase === "reveal"}
                    />
                  ) : (
                    "?"
                  )}
                </DieFace>
              </div>
              <span className="thrown-die-kind">d{die.sides}</span>
            </div>
          ))}
        </div>
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
      {count > dice.length ? (
        <p className="editor-hint">{t.compact(dice.length, count)}</p>
      ) : null}
    </div>
  );
}
