import type { Roll } from "./api";
import { composition } from "./model";
import { rollDate } from "./format";
import { diceText as t } from "./strings";
import RollDetails from "./RollDetails";
import type { useDiceHistory } from "./useDiceHistory";
export default function DiceHistory({
  history,
  disabled,
  onReview,
}: {
  history: ReturnType<typeof useDiceHistory>;
  disabled: boolean;
  onReview: (roll: Roll) => void;
}) {
  return (
    <aside className="dice-history" aria-label={t.history}>
      <h4>{t.history}</h4>
      {history.loading && !history.rows.length ? (
        <p role="status">{t.loading}</p>
      ) : null}
      {history.error ? (
        <div className="error" role="alert">
          <p>{history.error}</p>
          <button
            type="button"
            disabled={history.loading}
            onClick={history.retry}
          >
            {t.retry}
          </button>
        </div>
      ) : null}
      {!history.loading && !history.error && !history.rows.length ? (
        <p>{t.noHistory}</p>
      ) : null}
      <ol className="dice-history-list">
        {history.rows.map((roll) => (
          <li key={roll.id}>
            <details>
              <summary
                aria-label={t.historyLabel(
                  rollDate(roll.createdAt),
                  composition(roll.groups),
                  roll.total,
                )}
              >
                <time dateTime={roll.createdAt}>
                  {rollDate(roll.createdAt)}
                </time>
                <span>{composition(roll.groups)}</span>
                <b>{roll.total}</b>
              </summary>
              <RollDetails roll={roll} />
              <button
                type="button"
                disabled={disabled}
                onClick={() => onReview(roll)}
              >
                {t.review}
              </button>
            </details>
          </li>
        ))}
      </ol>
      {history.cursor ? (
        <button
          type="button"
          disabled={history.loading}
          onClick={() => void history.more()}
        >
          {history.loading ? t.loading : t.more}
        </button>
      ) : null}
    </aside>
  );
}
