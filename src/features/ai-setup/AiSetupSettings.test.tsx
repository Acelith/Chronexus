import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import AiSetupSettings from "./AiSetupSettings";
import { aiSetupApi, type SetupStatus } from "./api";
vi.mock("./api", async (original) => ({
  ...(await original<typeof import("./api")>()),
  aiSetupApi: {
    status: vi.fn(),
    installRuntime: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    pull: vi.fn(),
    cancel: vi.fn(),
    removeRuntime: vi.fn(),
  },
}));
const base: SetupStatus = {
  supportedPlatform: true,
  managedInstalled: false,
  managedRunning: false,
  runtimeDir: "C:/synthetic/ai-runtime/ollama-0.40.10",
  modelsDir: "C:/synthetic/ai-runtime/models",
  runtime: "stopped",
  runtimeVersion: null,
  models: [
    {
      role: "primary",
      name: "qwen3.8:27b-q4_K_M",
      label: "Qwen3.8-27B",
      downloadBytes: 17741860480,
      state: "unknown",
    },
    {
      role: "secondary",
      name: "gemma4:12b",
      label: "Gemma 4 12B",
      downloadBytes: 7556499296,
      state: "unknown",
    },
  ],
  gpus: [{ name: "Synthetic GPU", memoryMib: 16376 }],
  freeBytes: 50e9,
  runtimeDownloadBytes: 1586229413,
  runtimeInstallBytes: 3816998068,
};
beforeEach(() => vi.resetAllMocks());
test("non contatta nulla all’apertura e installa Ollama solo dopo conferma", async () => {
  const user = userEvent.setup();
  render(<AiSetupSettings disabled={false} />);
  expect(aiSetupApi.status).not.toHaveBeenCalled();
  vi.mocked(aiSetupApi.status)
    .mockResolvedValueOnce(base)
    .mockResolvedValueOnce({ ...base, managedInstalled: true });
  await user.click(
    screen.getByRole("button", { name: "Controlla componenti" }),
  );
  expect(await screen.findByText(/Synthetic GPU/)).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Scarica modello…" }),
  ).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Installa Ollama…" }));
  const confirm = screen.getByRole("group", {
    name: "Conferma installazione di Ollama",
  });
  expect(confirm).toHaveTextContent(
    "github.com/ollama/ollama/releases/download/v0.40.10",
  );
  expect(confirm).toHaveTextContent("C:/synthetic/ai-runtime/ollama-0.40.10");
  expect(aiSetupApi.installRuntime).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Annulla" }));
  expect(aiSetupApi.installRuntime).not.toHaveBeenCalled();
  vi.mocked(aiSetupApi.installRuntime).mockResolvedValue(undefined);
  await user.click(screen.getByRole("button", { name: "Installa Ollama…" }));
  await user.click(screen.getByRole("button", { name: "Scarica e installa" }));
  expect(
    await screen.findByText(/Ollama installato e verificato/),
  ).toBeVisible();
  expect(screen.getByRole("button", { name: "Avvia Ollama" })).toBeEnabled();
});
test("scarica solo il modello scelto dopo conferma e mostra gli errori", async () => {
  const user = userEvent.setup();
  const ready = {
    ...base,
    runtime: "ready" as const,
    runtimeVersion: "0.40.10",
    models: base.models.map((m) => ({ ...m, state: "absent" as const })),
  };
  vi.mocked(aiSetupApi.status).mockResolvedValue(ready);
  render(<AiSetupSettings disabled={false} />);
  await user.click(
    screen.getByRole("button", { name: "Controlla componenti" }),
  );
  await user.click(
    await screen.findByRole("radio", { name: /Gemma 4 12B · Secondario/ }),
  );
  await user.click(screen.getByRole("button", { name: "Scarica modello…" }));
  expect(
    screen.getByRole("group", { name: "Conferma download del modello" }),
  ).toHaveTextContent("Gemma 4 12B");
  vi.mocked(aiSetupApi.pull).mockRejectedValueOnce(
    Error("Download del modello annullato."),
  );
  await user.click(screen.getByRole("button", { name: "Scarica" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("annullato");
  expect(aiSetupApi.pull).toHaveBeenCalledWith(
    "secondary",
    expect.any(Function),
  );
  vi.mocked(aiSetupApi.pull).mockResolvedValueOnce({
    ...ready.models[1],
    state: "ready",
  });
  vi.mocked(aiSetupApi.status).mockResolvedValue({
    ...ready,
    models: [ready.models[0], { ...ready.models[1], state: "ready" }],
  });
  await user.click(screen.getByRole("button", { name: "Scarica modello…" }));
  await user.click(screen.getByRole("button", { name: "Scarica" }));
  await waitFor(() =>
    expect(screen.getByText(/Gemma 4 12B è pronto/)).toBeVisible(),
  );
  expect(screen.getByText("Gemma 4 12B scaricato e verificato.")).toBeVisible();
});
