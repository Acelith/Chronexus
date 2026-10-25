import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import BackupWorkspace from "./BackupWorkspace";
import { backupApi, backupFolderApi, type BackupPreview } from "./api";
import type { SaveGuard } from "../journal/Editor";

vi.mock("./api", () => ({
  backupApi: {
    create: vi.fn(),
    inspect: vi.fn(),
    restore: vi.fn(),
    cancel: vi.fn(),
  },
  BACKUP_STATUS_EVENT: "chronexus:backup-status",
  backupFolderApi: {
    list: vi.fn(),
    inspect: vi.fn(),
    copyLegacy: vi.fn(),
  },
}));
const emptyListing = { folders: [], backups: [], truncated: false };
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
  vi.mocked(backupFolderApi.list).mockResolvedValue(emptyListing);
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
  const button = screen.getByRole("button", { name: "Create backup" });
  await user.click(button);
  const receipt = await screen.findByRole("region", { name: "Backup created" });
  expect(within(receipt).getByText("E:/copie/nuovo.nodex")).toBeInTheDocument();
  expect(within(receipt).getByText("Attachments")).toBeInTheDocument();
  await user.click(button);
  expect(
    await screen.findByText("Backup cancelled. No file created."),
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
  await user.click(screen.getByRole("button", { name: "Select backup" }));
  expect(
    await screen.findByText("Selection cancelled. Archive unchanged."),
  ).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Select backup" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("checksum");
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  expect(backupApi.restore).not.toHaveBeenCalled();
  expect(onRestored).not.toHaveBeenCalled();
});
test("anteprima verificata richiede conferma, protegge navigazione e gestisce Tab ed Escape", async () => {
  const { user, getGuard } = setup();
  vi.mocked(backupApi.inspect).mockResolvedValue(preview);
  await user.click(screen.getByRole("button", { name: "Select backup" }));
  const dialog = await screen.findByRole("alertdialog");
  expect(dialog).toHaveTextContent("All current campaigns will be replaced");
  expect(dialog).toHaveTextContent("campagne.nodex");
  const cancel = within(dialog).getByRole("button", {
    name: "Cancel restore",
  });
  expect(cancel).toHaveFocus();
  expect(getGuard()?.dirty()).toBe(true);
  await expect(getGuard()?.flush()).rejects.toThrow("Confirm or cancel");
  await user.tab({ shift: true });
  expect(
    within(dialog).getByRole("button", { name: "Replace archive" }),
  ).toHaveFocus();
  await user.tab();
  expect(cancel).toHaveFocus();
  await user.keyboard("{Escape}");
  await waitFor(() =>
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
  );
  expect(backupApi.cancel).toHaveBeenCalledOnce();
  expect(backupApi.restore).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Select backup" })).toHaveFocus();
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
  await user.click(screen.getByRole("button", { name: "Select backup" }));
  await user.click(
    await screen.findByRole("button", { name: "Replace archive" }),
  );
  const receipt = await screen.findByRole("region", {
    name: "Restore completed",
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
  await user.click(screen.getByRole("button", { name: "Select backup" }));
  await user.click(
    await screen.findByRole("button", { name: "Replace archive" }),
  );
  expect(screen.getByRole("button", { name: "Cancel restore" })).toBeDisabled();
  await expect(getGuard()?.flush()).rejects.toThrow("Wait");
  reject(
    new Error("Copia preventiva non disponibile. Archivio corrente invariato."),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Copia preventiva",
  );
  expect(onRestored).not.toHaveBeenCalled();
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Select backup" })).toBeEnabled();
});
test("elenca i backup delle cartelle, ripristina con verifica e copia quelli legacy", async () => {
  const listed = {
    folders: [
      {
        location: "updates" as const,
        path: "C:/Users/Zoë/Documents/Chronexus/Backup aggiornamenti",
        exists: false,
        error: "C:/x è un collegamento simbolico o una giunzione",
      },
    ],
    backups: [
      {
        location: "periodic" as const,
        name: "chronexus-periodico-20261025T100000Z-abcd1234.nodex",
        kind: "periodic" as const,
        size: 2 * 1024 * 1024,
        modified: "2026-10-25T10:00:00Z",
        registered: true,
      },
      {
        location: "legacy" as const,
        name: "before-update-x.nodex",
        kind: "update" as const,
        size: 1024,
        modified: "2026-10-01T10:00:00Z",
        registered: false,
      },
    ],
    truncated: false,
  };
  vi.mocked(backupFolderApi.list).mockResolvedValue(listed);
  vi.mocked(backupFolderApi.inspect).mockResolvedValue(preview);
  vi.mocked(backupFolderApi.copyLegacy).mockResolvedValue(
    "C:/Docs/Chronexus/Backup aggiornamenti/before-update-x.nodex",
  );
  const { user } = setup();
  const region = await screen.findByRole("region", {
    name: "Backups in the Chronexus folders",
  });
  expect(within(region).getByText(/giunzione/)).toBeInTheDocument();
  expect(
    within(region).getByText(/Periodic · Documents · Periodic backups/),
  ).toBeInTheDocument();
  expect(within(region).getByText(/2\.0 MiB/)).toBeInTheDocument();
  expect(within(region).getByText(/· 1 KiB/)).toBeInTheDocument();
  const copy = within(region).getAllByRole("button", {
    name: "Copy to Documents",
  });
  expect(copy).toHaveLength(1);
  await user.click(copy[0]);
  expect(backupFolderApi.copyLegacy).toHaveBeenCalledWith(
    "before-update-x.nodex",
  );
  expect(
    await screen.findByText(/The original stays in the data folder/),
  ).toBeInTheDocument();
  await user.click(
    within(region).getByRole("button", {
      name: "Verify and restore chronexus-periodico-20261025T100000Z-abcd1234.nodex",
    }),
  );
  expect(backupFolderApi.inspect).toHaveBeenCalledWith(
    "periodic",
    "chronexus-periodico-20261025T100000Z-abcd1234.nodex",
  );
  expect(await screen.findByRole("alertdialog")).toHaveTextContent(
    "campagne.nodex",
  );
});
test("mostra lo stato vuoto dell’elenco", async () => {
  setup();
  expect(
    await screen.findByText("No backups in the Chronexus folders yet."),
  ).toBeInTheDocument();
});
