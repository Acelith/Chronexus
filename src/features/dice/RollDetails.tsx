import { valuesFor } from "./model";
import type { Roll } from "./api";
import { composition } from "./model";
import { diceText as t } from "./strings";
export default function RollDetails({ roll }: { roll: Roll }) {
  return (
    <div className="roll-details">
      <p className="roll-formula">{composition(roll.groups)}</p>
      {roll.groups.map((group) => (
        <section
          className="roll-group"
          key={group.sides}
          aria-label={t.results(group.sides)}
        >
          <div>
            <strong>
              {group.quantity}d{group.sides}
            </strong>
            <span>
              {t.subtotal}: <b>{group.subtotal}</b>
            </span>
          </div>
          <ol aria-label={t.results(group.sides)}>
            {valuesFor(roll.id, group).map(({ id, value }) => (
              <li
                key={id}
                className={
                  value === 6 || value === 9 ? "value-disambiguated" : ""
                }
              >
                {value}
              </li>
            ))}
          </ol>
        </section>
      ))}
      <p className="roll-total">
        {t.total}
        <strong>{roll.total}</strong>
      </p>
    </div>
  );
}
