import { afterEach, expect, test, vi } from "vitest";
import { Autosave } from "./autosave";

afterEach(() => vi.useRealTimers());

test("debounces typing and saves only the latest document", async () => {
  vi.useFakeTimers();
  const write = vi.fn().mockResolvedValue(1);
  const report = vi.fn();
  const saver = new Autosave(0, write, report);
  saver.change("primo");
  saver.change("secondo");
  expect(saver.dirty).toBe(true);
  await vi.advanceTimersByTimeAsync(500);
  expect(write).toHaveBeenCalledExactlyOnceWith("secondo", 0);
  expect(report).toHaveBeenLastCalledWith({ kind: "saved" });
  expect(saver.dirty).toBe(false);
});

test("serializes concurrent saves and flushes changes received during a write", async () => {
  let resolve!: (value: number) => void;
  const write = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<number>((done) => {
          resolve = done;
        }),
    )
    .mockResolvedValueOnce(2);
  const saver = new Autosave(0, write, vi.fn());
  saver.change("prima");
  const a = saver.flush();
  saver.change("ultima");
  const b = saver.flush();
  const c = saver.flush();
  expect(write).toHaveBeenCalledTimes(1);
  resolve(1);
  await Promise.all([a, b, c]);
  expect(write.mock.calls).toEqual([
    ["prima", 0],
    ["ultima", 1],
  ]);
  expect(saver.dirty).toBe(false);
});

test("an error stays visible and the next attempt preserves notes", async () => {
  const write = vi
    .fn()
    .mockRejectedValueOnce(new Error("Disk full"))
    .mockResolvedValueOnce(1);
  const report = vi.fn();
  const saver = new Autosave(0, write, report);
  saver.change("do not lose");
  await expect(saver.flush()).rejects.toThrow("Disk full");
  expect(saver.dirty).toBe(true);
  expect(report).toHaveBeenLastCalledWith({
    kind: "error",
    message: "Disk full",
  });
  await saver.flush();
  expect(write.mock.calls).toEqual([
    ["do not lose", 0],
    ["do not lose", 0],
  ]);
  expect(saver.dirty).toBe(false);
});

test("flush saves before switching notes without waiting for debounce", async () => {
  vi.useFakeTimers();
  const write = vi.fn().mockResolvedValue(3);
  const saver = new Autosave(2, write, vi.fn());
  saver.change("due paragrafi");
  await saver.flush();
  await vi.advanceTimersByTimeAsync(1000);
  expect(write).toHaveBeenCalledExactlyOnceWith("due paragrafi", 2);
});
