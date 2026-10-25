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
  expect(screen.getByRole("note")).toHaveTextContent("are not encrypted");
  expect(screen.getByText(/Disco pieno/)).toHaveTextContent("try again");
  expect(screen.getByText("Periodic backups off")).toBeInTheDocument();
  const save = screen.getByRole("button", { name: "Save schedule" });
  expect(save).toBeDisabled();
  await user.click(screen.getByRole("checkbox"));
  await user.selectOptions(screen.getByLabelText("Frequency"), "hours");
  const hours = screen.getByLabelText(/Hours between backups/);
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
    await screen.findByText("At the next idle moment"),
  ).toBeInTheDocument();
  expect(screen.getByText("Backup schedule saved.")).toBeInTheDocument();
});
test("scelta cartella annullata, ritorno ai Documenti ed errore del backup immediato", async () => {
  const user = userEvent.setup();
  render(<BackupSettings disabled={false} />);
  await screen.findByText("Periodic backups off");
  const choose = screen.getByRole("button", {
    name: "Choose another folder…",
  });
  vi.mocked(backupFolderApi.chooseDestination).mockResolvedValueOnce(null);
  await user.click(choose);
  expect(await screen.findByText("No folder chosen.")).toBeInTheDocument();
  vi.mocked(backupFolderApi.chooseDestination).mockResolvedValueOnce({
    ...base,
    preferences: { ...base.preferences, destination: "E:/Archivio" },
    periodicFolder: "E:/Archivio",
  });
  await user.click(choose);
  expect(await screen.findByText(/folder chosen by you/)).toBeInTheDocument();
  vi.mocked(backupFolderApi.resetDestination).mockResolvedValue(base);
  await user.click(
    screen.getByRole("button", { name: "Use the Documents folder" }),
  );
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: "Use the Documents folder" }),
    ).not.toBeInTheDocument(),
  );
  vi.mocked(backupFolderApi.runNow).mockResolvedValue({
    path: null,
    error: "Cartella non scrivibile",
    removed: 0,
    keptUnverified: 0,
  });
  await user.click(screen.getByRole("button", { name: "Run backup now" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Cartella non scrivibile",
  );
});
