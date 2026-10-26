import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { backupFolderApi } from "./api";
import {
  CHECK_EVERY_MS,
  FIRST_CHECK_MS,
  NOTICE_MS,
  usePeriodicBackup,
} from "./usePeriodicBackup";

vi.mock("./api", () => ({
  BACKUP_STATUS_EVENT: "chronexus:backup-status",
  backupFolderApi: { tick: vi.fn() },
}));
beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(backupFolderApi.tick).mockResolvedValue({
    ran: true,
    outcome: { path: "C:/b.nodex", error: null, removed: 1, keptUnverified: 0 },
    waiting: null,
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});
test("waits for idle, respects the app lock and retries on the next cycle", async () => {
  let allowed = false;
  const refreshed = vi.fn();
  window.addEventListener("chronexus:backup-status", refreshed);
  const { result } = renderHook(() => usePeriodicBackup(() => allowed));
  await act(async () => {
    vi.advanceTimersByTime(FIRST_CHECK_MS);
  });
  expect(backupFolderApi.tick).not.toHaveBeenCalled();
  allowed = true;
  window.dispatchEvent(new KeyboardEvent("keydown"));
  await act(async () => {
    vi.advanceTimersByTime(CHECK_EVERY_MS / 2);
  });
  expect(backupFolderApi.tick).not.toHaveBeenCalled();
  await act(async () => {
    vi.advanceTimersByTime(CHECK_EVERY_MS);
  });
  expect(backupFolderApi.tick).toHaveBeenCalledTimes(1);
  expect(result.current.outcome?.removed).toBe(1);
  expect(refreshed).toHaveBeenCalled();
  await act(async () => {
    vi.advanceTimersByTime(NOTICE_MS);
  });
  expect(result.current.outcome).toBeNull();
  window.removeEventListener("chronexus:backup-status", refreshed);
});
test("does not start while a text field has focus", async () => {
  const input = document.createElement("input");
  document.body.append(input);
  input.focus();
  renderHook(() => usePeriodicBackup(() => true));
  await act(async () => {
    vi.advanceTimersByTime(FIRST_CHECK_MS + CHECK_EVERY_MS * 2);
  });
  expect(backupFolderApi.tick).not.toHaveBeenCalled();
  input.remove();
});
