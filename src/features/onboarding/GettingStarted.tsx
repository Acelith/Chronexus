import { useEffect, useState } from "react";
import { Text } from "../../i18n/Text";
import { systemMessage, tr } from "../../i18n/store";
import { appText } from "../../strings";
import { onboardingApi, type FirstStart } from "./api";
import "./onboarding.css";

/** App settings panel (M32): reopen the tour, create or remove the demo campaign. */
export default function GettingStarted({
  disabled,
  onOpenTour,
  onDemoChanged,
}: {
  disabled: boolean;
  onOpenTour: () => void;
  /** Called with the new demo id, or null after removal, so the app reloads campaigns. */
  onDemoChanged: (campaignId: string | null) => void | Promise<void>;
}) {
  const [state, setState] = useState<FirstStart | null>(null);
  const [failed, setFailed] = useState("");
  const [working, setWorking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    onboardingApi
      .firstStart()
      .then((value) => {
        if (active) setState(value);
      })
      .catch((reason: unknown) => {
        if (active)
          setFailed(
            systemMessage(String((reason as Error)?.message ?? reason)) ?? "",
          );
      });
    return () => {
      active = false;
    };
  }, []);
  async function act(action: () => Promise<string>) {
    setWorking(true);
    setFailed("");
    setNotice("");
    try {
      setNotice(await action());
    } catch (reason) {
      setFailed(
        systemMessage(
          reason instanceof Error ? reason.message : String(reason),
        ) ?? "",
      );
    } finally {
      setWorking(false);
    }
  }
  const busy = disabled || working;
  const demo = state?.demoCampaignId ?? null;
  return (
    <div className="getting-started">
      <section>
        <h3>
          <Text source={"Guided tour"} />
        </h3>
        <p>
          <Text
            source={
              "A short walk through the main views. It changes nothing in your campaigns."
            }
          />
        </p>
        <button type="button" disabled={busy} onClick={onOpenTour}>
          <Text source={"Open the guided tour"} />
        </button>
      </section>
      <section>
        <h3>
          <Text source={"Demo campaign"} />
        </h3>
        <p>
          <Text
            source={
              "A small invented campaign with a journal, Codex pages, relationships, clues and a character. It is labelled Demo, cannot be shared or used for training, and is removed in one step."
            }
          />
        </p>
        {!state && !failed ? <p role="status">{appText.loading}</p> : null}
        {state && !demo ? (
          <button
            type="button"
            className="primary"
            disabled={busy}
            onClick={() =>
              void act(async () => {
                const created = await onboardingApi.createDemo();
                setState({ ...state, demoCampaignId: created.id });
                await onDemoChanged(created.id);
                return tr("Demo campaign created.");
              })
            }
          >
            <Text source={"Create the demo campaign"} />
          </button>
        ) : null}
        {demo && !confirming ? (
          <button
            type="button"
            className="danger"
            disabled={busy}
            onClick={() => setConfirming(true)}
          >
            <Text source={"Remove the demo campaign"} />
          </button>
        ) : null}
        {demo && confirming ? (
          <div
            className="card"
            role="group"
            aria-labelledby="demo-remove-title"
          >
            <h4 id="demo-remove-title">
              <Text source={"Remove the demo campaign?"} />
            </h4>
            <p>
              <Text
                source={
                  "Everything in the demo is deleted, including anything you added to it and its images. Your own campaigns are not touched."
                }
              />
            </p>
            <div className="actions">
              <button
                type="button"
                disabled={busy}
                autoFocus
                onClick={() => setConfirming(false)}
              >
                <Text source={"Cancel"} />
              </button>
              <button
                type="button"
                className="danger"
                disabled={busy}
                onClick={() =>
                  void act(async () => {
                    await onboardingApi.removeDemo(demo);
                    setState({ ...state!, demoCampaignId: null });
                    setConfirming(false);
                    await onDemoChanged(null);
                    return tr("Demo campaign removed.");
                  })
                }
              >
                <Text source={"Remove the demo"} />
              </button>
            </div>
          </div>
        ) : null}
        {notice ? (
          <p role="status" className="notice">
            {notice}
          </p>
        ) : null}
        {failed ? (
          <p role="alert" className="error">
            {failed}
          </p>
        ) : null}
      </section>
    </div>
  );
}
