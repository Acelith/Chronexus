import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import UpdateSettings from "./UpdateSettings";
import { updatesApi } from "./api";
vi.mock("./api", () => ({
  updatesApi: {
    overview: vi.fn(),
    save: vi.fn(),
    check: vi.fn(),
    download: vi.fn(),
    install: vi.fn(),
    cancel: vi.fn(),
  },
}));
const overview = {
  settings: { endpoint: "https://git.example/latest.json" },
  currentVersion: "0.4.0",
  backupDirectory: "C:/synthetic/update-backups",
};
const offer = {
  id: "update-1",
  version: "0.5.0",
  notes: "Note pubbliche <script>",
};
const run = async (action: () => Promise<void>) => action();
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(updatesApi.overview).mockResolvedValue(overview);
  vi.mocked(updatesApi.check).mockResolvedValue(offer);
  vi.mocked(updatesApi.download).mockResolvedValue(undefined);
});
test("legge solo impostazioni locali e controlla il server su richiesta", async () => {
  const user = userEvent.setup();
  render(<UpdateSettings busy={false} run={run} />);
  expect(await screen.findByText("0.4.0")).toBeInTheDocument();
  expect(updatesApi.check).not.toHaveBeenCalled();
  vi.mocked(updatesApi.check).mockResolvedValue(null);
  await user.click(
    screen.getByRole("button", { name: "Controlla aggiornamenti" }),
  );
  expect(
    await screen.findByText(/Nessuna nuova versione disponibile/),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Crea backup e installa" }),
  ).not.toBeInTheDocument();
});
test("permette installazione soltanto dopo download verificato e conserva errore backup", async () => {
  const user = userEvent.setup();
  render(<UpdateSettings busy={false} run={run} />);
  await user.click(
    await screen.findByRole("button", { name: "Controlla aggiornamenti" }),
  );
  expect(await screen.findByText(offer.notes)).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Crea backup e installa" }),
  ).not.toBeInTheDocument();
  await user.click(
    screen.getByRole("button", { name: "Scarica aggiornamento" }),
  );
  vi.mocked(updatesApi.install).mockRejectedValue(
    Error("Backup non riuscito: disco pieno."),
  );
  await user.click(
    await screen.findByRole("button", { name: "Crea backup e installa" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent("disco pieno");
  expect(
    screen.getByRole("button", { name: "Crea backup e installa" }),
  ).toBeInTheDocument();
});
test("firma non valida impedisce di proporre installazione", async () => {
  const user = userEvent.setup();
  vi.mocked(updatesApi.download).mockRejectedValue(Error("Firma non valida"));
  render(<UpdateSettings busy={false} run={run} />);
  await user.click(
    await screen.findByRole("button", { name: "Controlla aggiornamenti" }),
  );
  await user.click(
    await screen.findByRole("button", { name: "Scarica aggiornamento" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Firma non valida",
  );
  expect(
    screen.queryByRole("button", { name: "Crea backup e installa" }),
  ).not.toBeInTheDocument();
  expect(updatesApi.install).not.toHaveBeenCalled();
});
test("annulla un download e blocca le operazioni concorrenti", async () => {
  const user = userEvent.setup();
  let abort!: (error: Error) => void;
  vi.mocked(updatesApi.download).mockReturnValue(
    new Promise((_resolve, reject) => {
      abort = reject;
    }),
  );
  vi.mocked(updatesApi.cancel).mockImplementation(async () => {
    abort(Error("Download annullato"));
  });
  render(<UpdateSettings busy={false} run={run} />);
  await user.click(
    await screen.findByRole("button", { name: "Controlla aggiornamenti" }),
  );
  await user.click(
    await screen.findByRole("button", { name: "Scarica aggiornamento" }),
  );
  expect(
    screen.getByRole("button", { name: "Controlla aggiornamenti" }),
  ).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Annulla download" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("annullato");
  expect(updatesApi.cancel).toHaveBeenCalledOnce();
});
test("un nuovo canale deve essere salvato e invalida l’offerta precedente", async () => {
  const user = userEvent.setup();
  render(<UpdateSettings busy={false} run={run} />);
  await user.click(
    await screen.findByRole("button", { name: "Controlla aggiornamenti" }),
  );
  await user.click(screen.getByText("Server degli aggiornamenti"));
  const input = screen.getByRole("textbox", {
    name: "Indirizzo del canale aggiornamenti",
  });
  await user.clear(input);
  await user.type(input, "https://other.example/latest.json");
  expect(
    screen.getByRole("button", { name: "Controlla aggiornamenti" }),
  ).toBeDisabled();
  vi.mocked(updatesApi.save).mockResolvedValue({
    endpoint: "https://other.example/latest.json",
  });
  await user.click(
    screen.getByRole("button", { name: "Salva canale aggiornamenti" }),
  );
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: "Scarica aggiornamento" }),
    ).not.toBeInTheDocument(),
  );
  expect(updatesApi.save).toHaveBeenCalledWith({
    endpoint: "https://other.example/latest.json",
  });
});
