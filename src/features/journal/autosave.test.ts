import { afterEach, expect, test, vi } from "vitest";
import { Autosave } from "./autosave";

afterEach(() => vi.useRealTimers());

test("raggruppa le battute e salva soltanto il documento più recente", async () => {
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

test("serializza salvataggi concorrenti e scarica le modifiche arrivate durante la scrittura", async () => {
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

test("un errore resta visibile e il tentativo successivo conserva gli appunti", async () => {
  const write = vi
    .fn()
    .mockRejectedValueOnce(new Error("Disco pieno"))
    .mockResolvedValueOnce(1);
  const report = vi.fn();
  const saver = new Autosave(0, write, report);
  saver.change("non perdere");
  await expect(saver.flush()).rejects.toThrow("Disco pieno");
  expect(saver.dirty).toBe(true);
  expect(report).toHaveBeenLastCalledWith({
    kind: "error",
    message: "Disco pieno",
  });
  await saver.flush();
  expect(write.mock.calls).toEqual([
    ["non perdere", 0],
    ["non perdere", 0],
  ]);
  expect(saver.dirty).toBe(false);
});

test("flush salva subito prima di cambiare nota, senza attendere il debounce", async () => {
  vi.useFakeTimers();
  const write = vi.fn().mockResolvedValue(3);
  const saver = new Autosave(2, write, vi.fn());
  saver.change("due paragrafi");
  await saver.flush();
  await vi.advanceTimersByTimeAsync(1000);
  expect(write).toHaveBeenCalledExactlyOnceWith("due paragrafi", 2);
});
