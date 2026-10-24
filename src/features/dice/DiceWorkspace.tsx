import { useEffect, useRef } from "react";
import type { SaveGuard } from "../journal/Editor";
import { diceText as t } from "./strings";
import DiceComposer from "./DiceComposer";
import DiceScene, { EmptyScene } from "./DiceScene";
import RollDetails from "./RollDetails";
import DiceHistory from "./DiceHistory";
import { useDiceHistory } from "./useDiceHistory";
import { useDiceRoller } from "./useDiceRoller";
import "./dice.css";
export default function DiceWorkspace({
  campaignId,
  register,
  busy = false,
}: {
  campaignId: string;
  register: (guard: SaveGuard | null) => void;
  busy?: boolean;
}) {
  const history = useDiceHistory(campaignId);
  const {
    quantities,
    setQuantities,
    current,
    pending,
    animating,
    playback,
    replay,
    error,
    done,
    submit,
    review,
  } = useDiceRoller(campaignId, register, busy, history.add);
  const arena = useRef<HTMLElement>(null);
  const currentId = current?.id;
  useEffect(() => {
    if (currentId)
      arena.current
        ?.querySelector(".dice-scene")
        ?.scrollIntoView?.({ block: "nearest", behavior: "auto" });
  }, [currentId]);
  return (
    <section
      className={`dice-workspace ${error ? "has-error" : ""}`}
      aria-label={t.menu}
    >
      <header className="dice-heading">
        <h3>{t.title}</h3>
        <p>{t.intro}</p>
      </header>
      <DiceComposer
        quantities={quantities}
        onChange={setQuantities}
        onRoll={submit}
        disabled={busy || pending || animating}
        pending={pending}
      />
      {error ? (
        <p role="alert" className="error">
          {error}
        </p>
      ) : null}
      <p className="sr-only" role="status">
        {current && !animating ? t.readResult(current.total) : ""}
      </p>
      <div className="dice-layout">
        <article className="dice-arena-column" ref={arena}>
          {current ? (
            <>
              <DiceScene
                key={`${current.id}:${playback}`}
                roll={current}
                animate={animating}
                onDone={done}
              />
              <p className="editor-hint">
                {t.selectionReset} {t.animationHint}
              </p>
              {!animating ? (
                <button
                  type="button"
                  disabled={busy || pending}
                  onClick={replay}
                >
                  {t.replay}
                </button>
              ) : null}
              {!animating ? (
                <details className="dice-current-detail">
                  <summary>
                    {t.saved} · {t.details}
                  </summary>
                  <RollDetails roll={current} />
                </details>
              ) : null}
            </>
          ) : (
            <EmptyScene />
          )}
        </article>
        <DiceHistory
          history={history}
          disabled={busy || pending || animating}
          onReview={review}
          pendingRevealId={animating && current ? current.id : null}
        />
      </div>
    </section>
  );
}
