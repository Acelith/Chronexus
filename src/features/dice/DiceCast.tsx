import type { CSSProperties } from "react";
import type { sceneDice } from "./model";
import DieFace from "./DieFace";
import SlotNumber from "./SlotNumber";
export default function DiceCast({
  dice,
  revealed,
  animate,
}: {
  dice: ReturnType<typeof sceneDice>;
  revealed: boolean;
  animate: boolean;
}) {
  return (
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
                <SlotNumber value={die.value} animate={animate} />
              ) : (
                "?"
              )}
            </DieFace>
          </div>
          <span className="thrown-die-kind">d{die.sides}</span>
        </div>
      ))}
    </div>
  );
}
