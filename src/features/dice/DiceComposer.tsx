import { Text } from "../../i18n/Text";
import { tr } from "../../i18n/store";
import { useId } from "react";
import { SIDES, type Sides } from "./api";
import {
  composition,
  selections,
  emptyQuantities,
  type Quantities,
} from "./model";
import { diceText as t } from "./strings";
import DieFace from "./DieFace";
export default function DiceComposer({
  quantities,
  onChange,
  onRoll,
  disabled,
  pending,
}: {
  quantities: Quantities;
  onChange: (next: Quantities) => void;
  onRoll: () => void;
  disabled: boolean;
  pending: boolean;
}) {
  const id = useId();
  let preview = t.preview,
    validation = "",
    count = 0;
  try {
    const groups = selections(quantities);
    preview = composition(groups);
    count = groups.reduce((sum, g) => sum + g.quantity, 0);
  } catch (error) {
    if (error instanceof Error && error.message !== t.emptyError)
      validation = error.message;
  }
  function step(sides: Sides, by: number) {
    const value = Number(quantities[sides]);
    onChange({
      ...quantities,
      [sides]: String(
        Math.min(
          50,
          Math.max(0, (Number.isFinite(value) ? Math.floor(value) : 0) + by),
        ),
      ),
    });
  }
  return (
    <form
      className="dice-composer"
      aria-label={t.composer}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        onRoll();
      }}
    >
      <fieldset disabled={disabled}>
        <legend className="sr-only">{t.composer}</legend>
        <div className="dice-options">
          {SIDES.map((sides) => (
            <div
              className={`dice-option ${Number(quantities[sides]) > 0 ? "chosen" : ""}`}
              key={sides}
            >
              <button
                type="button"
                className="dice-type-button"
                aria-label={t.add(sides)}
                onClick={() => step(sides, 1)}
              >
                <DieFace sides={sides}>
                  <span className="dice-kind-label">
                    <Text source={"d"} />
                    {sides}
                  </span>
                </DieFace>
              </button>
              <div className="dice-quantity">
                <label className="sr-only" htmlFor={`${id}-${sides}`}>
                  {t.quantity(sides)}
                </label>
                <span className="dice-stepper">
                  <button
                    type="button"
                    aria-label={t.remove(sides)}
                    onClick={() => step(sides, -1)}
                  >
                    −
                  </button>
                  <input
                    id={`${id}-${sides}`}
                    type="number"
                    inputMode="numeric"
                    min="0"
                    max="50"
                    step="1"
                    value={quantities[sides]}
                    onChange={(e) =>
                      onChange({ ...quantities, [sides]: e.target.value })
                    }
                  />
                  <button
                    type="button"
                    aria-label={t.add(sides) + tr(" alla quantità")}
                    onClick={() => step(sides, 1)}
                  >
                    +
                  </button>
                </span>
              </div>
            </div>
          ))}
        </div>
      </fieldset>
      <div className="dice-throw-bar">
        <div className="dice-selection" aria-live="polite">
          <span>{t.composition}</span>
          <strong>{preview}</strong>
        </div>
        <button
          type="button"
          disabled={
            disabled || !Object.values(quantities).some((v) => Number(v) !== 0)
          }
          onClick={() => onChange(emptyQuantities())}
        >
          {t.zero}
        </button>
        <button
          type="submit"
          className="primary dice-throw"
          disabled={disabled || !count || !!validation}
        >
          {pending ? t.saving : t.roll}
        </button>
      </div>
      {validation ? (
        <p className="error" role="alert">
          {validation}
        </p>
      ) : null}
      <p className="editor-hint">{t.limits}</p>
    </form>
  );
}
