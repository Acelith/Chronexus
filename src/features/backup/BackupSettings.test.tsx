import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import BackupSettings from "./BackupSettings";
import { backupFolderApi, type BackupFolderStatus } from "./api";

vi.mock("./api", () => ({
  BACKUP_STATUS_EVENT: "chronexus:backup-status",
  backupFolderApi: {
    status: vi.fn(),
    saveSchedule: vi.fn(),
    chooseDestination: vi.fn(),
    resetDestination: vi.fn(),
    open: vi.fn(),
    runNow: vi.fn(),
  },
}));
const base: BackupFolderStatus = {
  preferences: {
    version: 1,
    enabled: false,
    frequency: "weekly",
    hours: 12,
    keep: 5,
    destination: null,
  },
  documentsFolder: "C:/Users/Zoë/OneDrive/Documenti/Chronexus",
  periodicFolder: "C:/Users/Zoë/OneDrive/Documenti/Chronexus/Backup periodici",
  updatesFolder:
    "C:/Users/Zoë/OneDrive/Documenti/Chronexus/Backup aggiornamenti",
  cloudSynced: true,
  lastSuccess: null,
  lastAttempt: "2026-10-25T08:00:00Z",
  lastError: "Disco pieno",
  nextDue: null,
  dueNow: false,
  registered: 0,
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(backupFolderApi.status).mockResolvedValue(base);
});
test("mostra percorsi, avviso cloud ed errore con azione e salva la pianificazione", async () => {
  const user = userEvent.setup();
  render(<BackupSettings disabled={false} />);
  expect(
    await screen.findByText(/Backup aggiornamenti$/, { selector: "bdi" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("note")).toHaveTextContent("non sono cifrati");
  expect(screen.getByText(/Disco pieno/)).toHaveTextContent("riproverà");
  expect(screen.getByText("Backup periodici disattivati")).toBeInTheDocument();
  const save = screen.getByRole("button", { name: "Salva pianificazione" });
  expect(save).toBeDisabled();
  await user.click(screen.getByRole("checkbox"));
  await user.selectOptions(screen.getByLabelText("Frequenza"), "hours");
  const hours = screen.getByLabelText(/Ore tra un backup/);
  await user.clear(hours);
  await user.type(hours, "6");
  vi.mocked(backupFolderApi.saveSchedule).mockResolvedValue({
    ...base,
    preferences: {
      ...base.preferences,
      enabled: true,
      frequency: "hours",
      hours: 6,
    },
    dueNow: true,
  });
  await user.click(save);
  expect(backupFolderApi.saveSchedule).toHaveBeenCalledWith({
    enabled: true,
    frequency: "hours",
    hours: 6,
    keep: 5,
  });
  expect(
    await screen.findByText("Al prossimo momento di inattività"),
  ).toBeInTheDocument();
  expect(
    screen.getByText("Pianificazione dei backup salvata."),
  ).toBeInTheDocument();
});
test("scelta cartella annullata, ritorno ai Documenti ed errore del backup immediato", async () => {
  const user = userEvent.setup();
  render(<BackupSettings disabled={false} />);
  await screen.findByText("Backup periodici disattivati");
  const choose = screen.getByRole("button", {
    name: "Scegli un’altra cartella…",
  });
  vi.mocked(backupFolderApi.chooseDestination).mockResolvedValueOnce(null);
  await user.click(choose);
  expect(
    await screen.findByText("Nessuna cartella scelta."),
  ).toBeInTheDocument();
  vi.mocked(backupFolderApi.chooseDestination).mockResolvedValueOnce({
    ...base,
    preferences: { ...base.preferences, destination: "E:/Archivio" },
    periodicFolder: "E:/Archivio",
  });
  await user.click(choose);
  expect(await screen.findByText(/cartella scelta da te/)).toBeInTheDocument();
  vi.mocked(backupFolderApi.resetDestination).mockResolvedValue(base);
  await user.click(
    screen.getByRole("button", { name: "Usa la cartella Documenti" }),
  );
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: "Usa la cartella Documenti" }),
    ).not.toBeInTheDocument(),
  );
  vi.mocked(backupFolderApi.runNow).mockResolvedValue({
    path: null,
    error: "Cartella non scrivibile",
    removed: 0,
    keptUnverified: 0,
  });
  await user.click(screen.getByRole("button", { name: "Esegui backup ora" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Cartella non scrivibile",
  );
});
