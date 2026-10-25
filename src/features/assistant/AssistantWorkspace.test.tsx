import policy from "../../ai-models.json";
import { campaignAi } from "./campaignApi";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import AssistantWorkspace from "./AssistantWorkspace";
import { assistantApi, type Turn, type Event } from "./api";
import type { SaveGuard } from "../journal/Editor";
vi.mock("./campaignApi", () => ({ campaignAi: { get: vi.fn() } }));
vi.mock("./api", () => ({
  assistantApi: {
    settings: vi.fn(),
    history: vi.fn(),
    rules: vi.fn(),
    probe: vi.fn(),
    configure: vi.fn(),
    ask: vi.fn(),
    cancel: vi.fn(),
    source: vi.fn(),
    remove: vi.fn(),
  },
}));
const settings = {
  enabled: true,
  model: policy.primary.name,
  digest: "a".repeat(64),
  specialization: "multilingual-rag",
};
const turn: Turn = {
  id: "turn",
  campaignId: "c",
  question: "Chi è Mirna?",
  mode: "campaign",
  edition: null,
  model: settings.model,
  digest: settings.digest,
  status: "complete",
  answer: "Mirna è una cartografa [S1].",
  sources: [
    {
      key: "S1",
      kind: "page",
      sourceId: "page",
      blockId: "block",
      title: "Mirna",
      revision: 1,
      text: "Mirna è una cartografa.",
      hash: "h",
      edition: null,
    },
  ],
  metrics: {
    gpuBytes: 3105924054,
    processor: "gpu",
    elapsedMs: 1000,
    excludedSourceCount: 1,
  },
  error: "",
  createdAt: "2026-10-23T10:00:00Z",
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(campaignAi.get).mockResolvedValue({
    profile: { edition: "5e-2014", ruleKeys: [] },
  } as unknown as Awaited<ReturnType<typeof campaignAi.get>>);
  vi.mocked(assistantApi.settings).mockResolvedValue(settings);
  vi.mocked(assistantApi.history).mockResolvedValue([]);
  vi.mocked(assistantApi.rules).mockResolvedValue([]);
});
test("does not contact the runtime on mount; explicit activation requires consent", async () => {
  vi.mocked(assistantApi.settings).mockResolvedValue({
    ...settings,
    enabled: false,
  });
  vi.mocked(assistantApi.probe).mockResolvedValue({
    version: "test",
    cloudDisabled: true,
    models: [
      {
        name: settings.model,
        digest: settings.digest,
        weightDigest: policy.primary.weightDigest,
        quantization: "Q4_K_M",
        dndSpecialized: false,
        residentBytes: 0,
        gpuBytes: 0,
      },
    ],
  });
  vi.mocked(assistantApi.configure).mockResolvedValue(settings);
  render(
    <AssistantWorkspace campaignId="c" register={vi.fn()} onSource={vi.fn()} />,
  );
  await screen.findByRole("heading", { name: "Local assistant" });
  expect(assistantApi.probe).not.toHaveBeenCalled();
  expect(
    screen.getByRole("button", { name: "Ask the sources" }),
  ).toBeDisabled();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Check Ollama" }));
  await screen.findByText(/cloud disabled and verified/);
  expect(
    screen.getByRole("button", { name: "Enable local model" }),
  ).toBeDisabled();
  await user.click(
    screen.getByRole("checkbox", { name: /I am using a multilingual model/ }),
  );
  await user.click(screen.getByRole("button", { name: "Enable local model" }));
  expect(assistantApi.configure).toHaveBeenCalledWith(
    true,
    settings.model,
    true,
    "c",
  );
});
test("streams, cancels on navigation and retains errors and partial answers", async () => {
  const user = userEvent.setup(),
    register = vi.fn();
  let resolve!: (t: Turn) => void;
  let receive!: (e: Event) => void;
  vi.mocked(assistantApi.ask).mockImplementation((_, event) => {
    receive = event;
    return new Promise((r) => {
      resolve = r;
    });
  });
  vi.mocked(assistantApi.cancel).mockImplementation(async () => {
    resolve({
      ...turn,
      status: "cancelled",
      answer: "Mirna…",
      error: "Generation cancelled.",
    });
  });
  render(
    <AssistantWorkspace
      campaignId="c"
      register={register}
      onSource={vi.fn()}
    />,
  );
  await screen.findByLabelText("Question");
  await user.type(screen.getByLabelText("Question"), "Chi è Mirna?");
  await user.click(screen.getByRole("button", { name: "Ask the sources" }));
  const request = vi.mocked(assistantApi.ask).mock.calls[0][0];
  act(() => receive({ requestId: request.id, phase: "token", text: "Mirna…" }));
  expect(screen.getByLabelText("Answer arriving")).toHaveTextContent("Mirna…");
  const guard = register.mock.calls[0][0] as SaveGuard;
  expect(guard.dirty()).toBe(true);
  await act(() => guard.flush());
  expect(assistantApi.cancel).toHaveBeenCalledWith(request.id);
  await screen.findByText("Generation cancelled.");
  expect(
    screen.getByText("Cancelled · draft", { selector: "p" }),
  ).toBeVisible();
  expect(guard.dirty()).toBe(false);
});
test("changed sources require explicit current-version navigation and deletion confirms", async () => {
  vi.mocked(assistantApi.history).mockResolvedValue([turn]);
  vi.mocked(assistantApi.source).mockResolvedValue({
    available: true,
    changed: true,
    title: "Mirna nuova",
  });
  vi.mocked(assistantApi.remove).mockResolvedValue();
  const user = userEvent.setup(),
    onSource = vi.fn();
  render(
    <AssistantWorkspace
      campaignId="c"
      register={vi.fn()}
      onSource={onSource}
    />,
  );
  await user.click(await screen.findByRole("button", { name: /Chi è Mirna/ }));
  expect(
    screen.getByText(/Sources excluded for possible instructions: 1/),
  ).toBeVisible();
  await user.click(screen.getByText("[S1] Mirna"));
  await user.click(screen.getByRole("button", { name: "Open cited source" }));
  await screen.findByRole("button", { name: "Open current version" });
  expect(onSource).not.toHaveBeenCalled();
  await user.click(
    screen.getByRole("button", { name: "Open current version" }),
  );
  expect(onSource).toHaveBeenCalledWith(
    expect.objectContaining({ sourceId: "page", blockId: "block" }),
  );
  await user.click(screen.getByRole("button", { name: "Delete answer" }));
  expect(assistantApi.remove).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Confirm deletion" }));
  await waitFor(() =>
    expect(assistantApi.remove).toHaveBeenCalledWith("c", "turn"),
  );
});
