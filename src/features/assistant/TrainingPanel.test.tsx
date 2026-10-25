import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import TrainingPanel from "./TrainingPanel";
import {
  trainingApi,
  type TrainingOverview,
  type TrainingJob,
  type TrainingProgress,
} from "./trainingApi";
import { assistantApi } from "./api";
import type { SaveGuard } from "../journal/Editor";
vi.mock("./trainingApi", () => ({
  trainingApi: { get: vi.fn(), start: vi.fn(), activate: vi.fn() },
}));
vi.mock("./api", () => ({ assistantApi: { cancel: vi.fn() } }));
const initial: TrainingOverview = {
  jobs: [],
  datasetHash: "hash-a",
  datasetBytes: 1024,
  sources: 1,
  blocked: 0,
  added: 1,
  changed: 0,
  removed: 0,
  backendInstalled: true,
  trainingSupported: true,
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(trainingApi.get).mockResolvedValue(initial);
  vi.mocked(assistantApi.cancel).mockResolvedValue(undefined);
});

test("Qwen resta utilizzabile per inferenza ma non abilita QLoRA Gemma", async () => {
  vi.mocked(trainingApi.get).mockResolvedValue({
    ...initial,
    trainingSupported: false,
  });
  render(
    <TrainingPanel
      campaignId="c"
      disabled={false}
      version="qwen"
      onActive={vi.fn()}
      onActivated={vi.fn()}
    />,
  );
  expect(
    await screen.findByText(/riaddestramento è qualificato solo per Gemma/),
  ).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Riaddestra sui nuovi dati" }),
  ).toBeDisabled();
  expect(trainingApi.start).not.toHaveBeenCalled();
});
test("requires explicit confirmation and cancels before navigation without activating", async () => {
  const user = userEvent.setup();
  let finish!: (j: TrainingJob) => void,
    progress!: (p: TrainingProgress) => void;
  let guard: SaveGuard | null = null;
  vi.mocked(trainingApi.start).mockImplementation((_, __, ___, receive) => {
    progress = receive;
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  render(
    <TrainingPanel
      campaignId="a"
      disabled={false}
      version="v1"
      register={(g) => {
        guard = g;
      }}
      onActive={vi.fn()}
      onActivated={vi.fn()}
    />,
  );
  await user.click(
    await screen.findByRole("button", { name: "Riaddestra sui nuovi dati" }),
  );
  expect(trainingApi.start).not.toHaveBeenCalled();
  await user.click(
    screen.getByRole("button", { name: "Conferma riaddestramento locale" }),
  );
  expect(trainingApi.start).toHaveBeenCalledWith(
    "a",
    expect.any(String),
    "hash-a",
    expect.any(Function),
  );
  progress({
    phase: "training",
    step: 2,
    steps: 8,
    message: "Passaggio reale",
  });
  await screen.findByText("Passaggio reale");
  expect(guard!.dirty()).toBe(true);
  const waiting = guard!.flush();
  await waitFor(() => expect(assistantApi.cancel).toHaveBeenCalled());
  finish({ status: "cancelled", error: "Annullato" } as TrainingJob);
  await waiting;
  expect(trainingApi.activate).not.toHaveBeenCalled();
});
test("blocks training when backend is missing or documents are suspicious", async () => {
  vi.mocked(trainingApi.get).mockResolvedValue({
    ...initial,
    backendInstalled: false,
    blocked: 1,
  });
  render(
    <TrainingPanel
      campaignId="b"
      disabled={false}
      version="v1"
      onActive={vi.fn()}
      onActivated={vi.fn()}
    />,
  );
  expect(
    await screen.findByRole("button", { name: "Riaddestra sui nuovi dati" }),
  ).toBeDisabled();
  expect(screen.getByRole("alert")).toHaveTextContent("possibili istruzioni");
  expect(trainingApi.start).not.toHaveBeenCalled();
});
