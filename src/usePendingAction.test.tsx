import { expect, test } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { usePendingAction } from "./usePendingAction";

test("one action at a time, notice on success and error on failure", async () => {
  const { result } = renderHook(() => usePendingAction());
  let release = () => {};
  const slow = new Promise<void>((done) => (release = done));
  let calls = 0;
  let first: Promise<void> | undefined;
  act(() => {
    first = result.current.perform(async () => {
      calls += 1;
      await slow;
      return "Saved.";
    });
  });
  expect(result.current.pending).toBe(true);
  await act(async () => {
    await result.current.perform(async () => {
      calls += 1;
    });
  });
  expect(calls).toBe(1);
  await act(async () => {
    release();
    await first;
  });
  expect(result.current).toMatchObject({ pending: false, notice: "Saved." });
  await act(() =>
    result.current.perform(async () => {
      throw Error("Disk full.");
    }),
  );
  expect(result.current).toMatchObject({ error: "Disk full.", notice: "" });
  await act(() => result.current.perform(async () => "x", { blocked: true }));
  expect(result.current.notice).toBe("");
});
