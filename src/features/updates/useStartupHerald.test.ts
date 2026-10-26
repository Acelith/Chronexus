import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import {
  IDLE_POLL_MS,
  STARTUP_DELAY_MS,
  useStartupHerald,
} from "./useStartupHerald";
import { heraldApi } from "./api";

vi.mock("./api", () => ({
  heraldApi: { startupCheck: vi.fn(), blocked: vi.fn(), record: vi.fn() },
}));
afterEach(() => {
  vi.useRealTimers();
});

test("the herald stays closed if the user starts writing during the blocked check", async () => {
  vi.useFakeTimers();
  let allowed = true;
  let resolveBlocked!: (blocked: boolean) => void;
  const offer = {
    offer: { id: "test", version: "99.0.0", notes: "" },
    sound: false,
  };
  vi.mocked(heraldApi.startupCheck).mockResolvedValue(offer);
  vi.mocked(heraldApi.blocked).mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveBlocked = resolve;
      }),
  );
  const { result, unmount } = renderHook(() => useStartupHerald(() => allowed));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(STARTUP_DELAY_MS);
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(IDLE_POLL_MS);
  });
  expect(heraldApi.blocked).toHaveBeenCalledOnce();
  allowed = false;
  const writing = document.createElement("textarea");
  document.body.append(writing);
  writing.focus();
  await act(async () => {
    resolveBlocked(false);
  });
  expect(result.current.announcement).toBeNull();
  expect(writing).toHaveFocus();
  // Once idle again, the next poll shows it.
  writing.remove();
  allowed = true;
  vi.mocked(heraldApi.blocked).mockResolvedValue(false);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(IDLE_POLL_MS);
  });
  expect(result.current.announcement).toEqual(offer);
  unmount();
});
