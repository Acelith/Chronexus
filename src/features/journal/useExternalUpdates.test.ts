import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useExternalUpdates } from "./useExternalUpdates";
const events = vi.hoisted(() => ({
  callback: undefined as undefined | ((e: { payload: string }) => void),
  stop: vi.fn(),
}));
vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => true }));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(
    async (_name: string, callback: (e: { payload: string }) => void) => {
      events.callback = callback;
      return events.stop;
    },
  ),
}));
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});
it("preserves a dirty editor and refreshes only after saving", async () => {
  vi.useFakeTimers();
  let dirty = true;
  const refresh = vi.fn(async () => true);
  const h = renderHook(() =>
    useExternalUpdates("campaign", () => !dirty, refresh),
  );
  act(() => events.callback?.({ payload: "campaign" }));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1500);
  });
  expect(refresh).not.toHaveBeenCalled();
  dirty = false;
  await act(async () => {
    await vi.advanceTimersByTimeAsync(500);
  });
  expect(refresh).toHaveBeenCalledOnce();
  h.unmount();
});
it("ignores other campaigns and cancels pending refresh on unmount", async () => {
  vi.useFakeTimers();
  const refresh = vi.fn(async () => true);
  const h = renderHook(() => useExternalUpdates("one", () => true, refresh));
  act(() => events.callback?.({ payload: "other" }));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(500);
  });
  expect(refresh).not.toHaveBeenCalled();
  act(() => events.callback?.({ payload: "one" }));
  h.unmount();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
  expect(refresh).not.toHaveBeenCalled();
  expect(events.stop).toHaveBeenCalled();
});
it("retries a deferred refresh without concurrent calls", async () => {
  vi.useFakeTimers();
  const refresh = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
  const h = renderHook(() => useExternalUpdates("one", () => true, refresh));
  act(() => events.callback?.({ payload: "one" }));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
  expect(refresh).toHaveBeenCalledTimes(2);
  h.unmount();
});
