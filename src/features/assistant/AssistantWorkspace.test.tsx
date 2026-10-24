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
  model: "qwen3:4b-instruct",
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
        weightDigest: "w",
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
  await screen.findByRole("heading", { name: "Assistente locale" });
  expect(assistantApi.probe).not.toHaveBeenCalled();
  expect(
    screen.getByRole("button", { name: "Chiedi alle fonti" }),
  ).toBeDisabled();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Controlla Ollama" }));
  await screen.findByText(/cloud disabilitato e verificato/);
  expect(
    screen.getByRole("button", { name: "Attiva modello locale" }),
  ).toBeDisabled();
  await user.click(
    screen.getByRole("checkbox", { name: /Uso un modello multilingue/ }),
  );
  await user.click(
    screen.getByRole("button", { name: "Attiva modello locale" }),
  );
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
      error: "Generazione annullata.",
    });
  });
  render(
    <AssistantWorkspace
      campaignId="c"
      register={register}
      onSource={vi.fn()}
    />,
  );
  await screen.findByLabelText("Domanda");
  await user.type(screen.getByLabelText("Domanda"), "Chi è Mirna?");
  await user.click(screen.getByRole("button", { name: "Chiedi alle fonti" }));
  const request = vi.mocked(assistantApi.ask).mock.calls[0][0];
  act(() => receive({ requestId: request.id, phase: "token", text: "Mirna…" }));
  expect(screen.getByLabelText("Risposta in arrivo")).toHaveTextContent(
    "Mirna…",
  );
  const guard = register.mock.calls[0][0] as SaveGuard;
  expect(guard.dirty()).toBe(true);
  await act(() => guard.flush());
  expect(assistantApi.cancel).toHaveBeenCalledWith(request.id);
  await screen.findByText("Generazione annullata.");
  expect(
    screen.getByText("Annullata · bozza", { selector: "p" }),
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
    screen.getByText(/Fonti escluse per possibili istruzioni: 1/),
  ).toBeVisible();
  await user.click(screen.getByText("[S1] Mirna"));
  await user.click(screen.getByRole("button", { name: "Apri fonte citata" }));
  await screen.findByRole("button", { name: "Apri versione attuale" });
  expect(onSource).not.toHaveBeenCalled();
  await user.click(
    screen.getByRole("button", { name: "Apri versione attuale" }),
  );
  expect(onSource).toHaveBeenCalledWith(
    expect.objectContaining({ sourceId: "page", blockId: "block" }),
  );
  await user.click(screen.getByRole("button", { name: "Elimina risposta" }));
  expect(assistantApi.remove).not.toHaveBeenCalled();
  await user.click(
    screen.getByRole("button", { name: "Conferma eliminazione" }),
  );
  await waitFor(() =>
    expect(assistantApi.remove).toHaveBeenCalledWith("c", "turn"),
  );
});
