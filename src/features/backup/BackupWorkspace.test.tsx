import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import BackupWorkspace from "./BackupWorkspace";
import { backupApi, type BackupPreview } from "./api";
import type { SaveGuard } from "../journal/Editor";

vi.mock("./api", () => ({
  backupApi: {
    create: vi.fn(),
    inspect: vi.fn(),
    restore: vi.fn(),
    cancel: vi.fn(),
  },
}));
const counts = {
  campaigns: 2,
  sessions: 12,
  pages: 4,
  mentions: 8,
  relationships: 1,
  attachments: 3,
};
const preview: BackupPreview = {
  token: "verified-token",
  fileName: "campagne.nodex",
  manifest: {
    format_version: 1,
    app_version: "0.1.0",
    created_at: "2026-10-23T10:00:00Z",
    schema_version: 4,
    scope: "all_campaigns",
    counts,
  },
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(backupApi.cancel).mockResolvedValue();
});
function setup() {
  let guard: SaveGuard | null = null;
  const register = vi.fn((value: SaveGuard | null) => {
    guard = value;
  });
  const onRestored = vi.fn().mockResolvedValue(undefined);
  render(<BackupWorkspace register={register} onRestored={onRestored} />);
  return { user: userEvent.setup(), getGuard: () => guard, onRestored };
}
test("crea backup con ricevuta e gestisce annullamento ed errore di destinazione", async () => {
  const { user } = setup();
  vi.mocked(backupApi.create)
    .mockResolvedValueOnce({ path: "E:/copie/nuovo.nodex", counts })
    .mockResolvedValueOnce(null)
    .mockRejectedValueOnce(
      new Error("Il file esiste già. Scegli un nuovo nome."),
    );
  const button = screen.getByRole("button", { name: "Crea backup" });
  await user.click(button);
  const receipt = await screen.findByRole("region", { name: "Backup creato" });
  expect(within(receipt).getByText("E:/copie/nuovo.nodex")).toBeInTheDocument();
  expect(within(receipt).getByText("Allegati")).toBeInTheDocument();
  await user.click(button);
  expect(
    await screen.findByText("Backup annullato. Nessun file creato."),
  ).toBeInTheDocument();
  await user.click(button);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Il file esiste già",
  );
});
test("il selettore annullato e il backup danneggiato non propongono ripristini", async () => {
  const { user, onRestored } = setup();
  vi.mocked(backupApi.inspect)
    .mockResolvedValueOnce(null)
    .mockRejectedValueOnce(
      new Error("Backup non valido: checksum non corrispondente."),
    );
  await user.click(screen.getByRole("button", { name: "Seleziona backup" }));
  expect(
    await screen.findByText("Selezione annullata. Archivio invariato."),
  ).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Seleziona backup" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("checksum");
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  expect(backupApi.restore).not.toHaveBeenCalled();
  expect(onRestored).not.toHaveBeenCalled();
});
test("anteprima verificata richiede conferma, protegge navigazione e gestisce Tab ed Escape", async () => {
  const { user, getGuard } = setup();
  vi.mocked(backupApi.inspect).mockResolvedValue(preview);
  await user.click(screen.getByRole("button", { name: "Seleziona backup" }));
  const dialog = await screen.findByRole("alertdialog");
  expect(dialog).toHaveTextContent(
    "Tutte le campagne attuali saranno sostituite",
  );
  expect(dialog).toHaveTextContent("campagne.nodex");
  const cancel = within(dialog).getByRole("button", {
    name: "Annulla ripristino",
  });
  expect(cancel).toHaveFocus();
  expect(getGuard()?.dirty()).toBe(true);
  await expect(getGuard()?.flush()).rejects.toThrow("Conferma o annulla");
  await user.tab({ shift: true });
  expect(
    within(dialog).getByRole("button", { name: "Sostituisci archivio" }),
  ).toHaveFocus();
  await user.tab();
  expect(cancel).toHaveFocus();
  await user.keyboard("{Escape}");
  await waitFor(() =>
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
  );
  expect(backupApi.cancel).toHaveBeenCalledOnce();
  expect(backupApi.restore).not.toHaveBeenCalled();
  expect(
    screen.getByRole("button", { name: "Seleziona backup" }),
  ).toHaveFocus();
  expect(getGuard()?.dirty()).toBe(false);
});
test("ripristina solo il token verificato, aggiorna campagne e mostra la copia preventiva", async () => {
  const { user, onRestored } = setup();
  vi.mocked(backupApi.inspect).mockResolvedValue(preview);
  vi.mocked(backupApi.restore).mockResolvedValue({
    safetyPath: "C:/dati/backups/prima.nodex",
    counts,
    warning: "Controlla la sincronizzazione su disco.",
  });
  await user.click(screen.getByRole("button", { name: "Seleziona backup" }));
  await user.click(
    await screen.findByRole("button", { name: "Sostituisci archivio" }),
  );
  const receipt = await screen.findByRole("region", {
    name: "Ripristino completato",
  });
  expect(backupApi.restore).toHaveBeenCalledWith("verified-token");
  expect(onRestored).toHaveBeenCalledOnce();
  expect(
    within(receipt).getByText("C:/dati/backups/prima.nodex"),
  ).toBeInTheDocument();
  expect(within(receipt).getByRole("alert")).toHaveTextContent(
    "sincronizzazione",
  );
});
test("blocca altre operazioni durante il lavoro e richiede nuova verifica dopo errore", async () => {
  const { user, getGuard, onRestored } = setup();
  vi.mocked(backupApi.inspect).mockResolvedValue(preview);
  let reject: (reason: Error) => void = () => {};
  vi.mocked(backupApi.restore).mockImplementation(
    () =>
      new Promise((_, rejectPromise) => {
        reject = rejectPromise;
      }),
  );
  await user.click(screen.getByRole("button", { name: "Seleziona backup" }));
  await user.click(
    await screen.findByRole("button", { name: "Sostituisci archivio" }),
  );
  expect(
    screen.getByRole("button", { name: "Annulla ripristino" }),
  ).toBeDisabled();
  await expect(getGuard()?.flush()).rejects.toThrow("Attendi");
  reject(
    new Error("Copia preventiva non disponibile. Archivio corrente invariato."),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Copia preventiva",
  );
  expect(onRestored).not.toHaveBeenCalled();
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Seleziona backup" }),
  ).toBeEnabled();
});
