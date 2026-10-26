import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, afterEach, expect, test, vi } from "vitest";
import DiceWorkspace from "./DiceWorkspace";
import DiceScene from "./DiceScene";
import { diceApi, type Roll } from "./api";
import { diceText as t } from "./strings";
import type { SaveGuard } from "../journal/Editor";
vi.mock("./api", async (original) => ({
  ...(await original<typeof import("./api")>()),
  diceApi: { roll: vi.fn(), history: vi.fn() },
}));
const saved: Roll = {
  id: "075732aa-c33c-4ee0-a6db-ef5f3e31dafd",
  campaignId: "campaign",
  createdAt: "2026-10-24T16:00:00Z",
  groups: [
    { sides: 6, quantity: 3, values: [6, 2, 4], subtotal: 12 },
    { sides: 20, quantity: 2, values: [20, 4], subtotal: 24 },
    { sides: 100, quantity: 1, values: [100], subtotal: 100 },
  ],
  total: 136,
};
function motion(reduced: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: reduced,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  motion(true);
  vi.mocked(diceApi.history).mockResolvedValue({ rolls: [], nextCursor: null });
  vi.mocked(diceApi.roll).mockResolvedValue(saved);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
test("empty state, all dice including d100 and mouse controls", async () => {
  const user = userEvent.setup();
  render(<DiceWorkspace campaignId="campaign" register={vi.fn()} />);
  await screen.findByText(t.noHistory);
  expect(screen.getByRole("button", { name: t.roll })).toBeDisabled();
  for (const sides of [4, 6, 8, 10, 12, 20, 100])
    expect(
      screen.getByRole("spinbutton", { name: t.quantity(sides) }),
    ).toHaveValue(0);
  await user.click(screen.getByRole("button", { name: t.add(6) }));
  await user.click(screen.getByRole("button", { name: t.add(6) }));
  expect(screen.getByRole("spinbutton", { name: t.quantity(6) })).toHaveValue(
    2,
  );
  await user.click(screen.getByRole("button", { name: t.remove(6) }));
  expect(screen.getByRole("spinbutton", { name: t.quantity(6) })).toHaveValue(
    1,
  );
  await user.click(screen.getByRole("button", { name: t.zero }));
  expect(screen.getByRole("button", { name: t.roll })).toBeDisabled();
});
test("mixed roll resets quantities and displays real results and history", async () => {
  const user = userEvent.setup();
  render(<DiceWorkspace campaignId="campaign" register={vi.fn()} />);
  await screen.findByText(t.noHistory);
  fireEvent.change(screen.getByLabelText(t.quantity(6)), {
    target: { value: "3" },
  });
  fireEvent.change(screen.getByLabelText(t.quantity(20)), {
    target: { value: "2" },
  });
  fireEvent.change(screen.getByLabelText(t.quantity(100)), {
    target: { value: "1" },
  });
  await user.click(screen.getByRole("button", { name: t.roll }));
  await waitFor(() =>
    expect(diceApi.roll).toHaveBeenCalledWith("campaign", expect.any(String), [
      { sides: 6, quantity: 3 },
      { sides: 20, quantity: 2 },
      { sides: 100, quantity: 1 },
    ]),
  );
  for (const sides of [4, 6, 8, 10, 12, 20, 100])
    expect(screen.getByLabelText(t.quantity(sides))).toHaveValue(0);
  await screen.findByText(t.readResult(136));
  const history = screen.getByRole("complementary", { name: t.history });
  await user.click(within(history).getByLabelText(/^Roll of/));
  expect(
    within(history).getByRole("list", { name: t.results(100) }),
  ).toHaveTextContent("100");
  expect(
    within(history).getByRole("list", { name: t.results(6) }),
  ).toHaveTextContent("624");
  expect(screen.getByRole("button", { name: t.roll })).toBeDisabled();
});
test("errors preserve selection and retry reuses the same ID", async () => {
  const user = userEvent.setup();
  vi.mocked(diceApi.roll).mockRejectedValueOnce(Error("Disk full"));
  render(<DiceWorkspace campaignId="campaign" register={vi.fn()} />);
  await screen.findByText(t.noHistory);
  fireEvent.change(screen.getByLabelText(t.quantity(100)), {
    target: { value: "1" },
  });
  await user.click(screen.getByRole("button", { name: t.roll }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Disk full");
  expect(screen.getByLabelText(t.quantity(100))).toHaveValue(1);
  const first = vi.mocked(diceApi.roll).mock.calls[0][1];
  await user.click(screen.getByRole("button", { name: t.roll }));
  await waitFor(() => expect(diceApi.roll).toHaveBeenCalledTimes(2));
  expect(vi.mocked(diceApi.roll).mock.calls[1][1]).toBe(first);
  await waitFor(() =>
    expect(screen.getByLabelText(t.quantity(100))).toHaveValue(0),
  );
});
test("duplicate submissions are blocked and closing waits for persistence", async () => {
  let resolve!: (value: Roll) => void;
  vi.mocked(diceApi.roll).mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }),
  );
  const register = vi.fn<(guard: SaveGuard | null) => void>();
  const user = userEvent.setup();
  render(<DiceWorkspace campaignId="campaign" register={register} />);
  await screen.findByText(t.noHistory);
  fireEvent.change(screen.getByLabelText(t.quantity(6)), {
    target: { value: "3" },
  });
  await user.dblClick(screen.getByRole("button", { name: t.roll }));
  expect(diceApi.roll).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: t.saving })).toBeDisabled();
  const guard = register.mock.calls.find((call) => call[0])![0]!;
  expect(guard.dirty()).toBe(true);
  let flushed = false;
  const pending = guard.flush().then(() => {
    flushed = true;
  });
  await Promise.resolve();
  expect(flushed).toBe(false);
  await act(async () => {
    resolve(saved);
    await pending;
  });
  expect(flushed).toBe(true);
  expect(guard.dirty()).toBe(false);
});
test("out-of-range and fractional quantities do not send requests", async () => {
  render(<DiceWorkspace campaignId="campaign" register={vi.fn()} />);
  await screen.findByText(t.noHistory);
  fireEvent.change(screen.getByLabelText(t.quantity(20)), {
    target: { value: "1.5" },
  });
  expect(screen.getByRole("alert")).toHaveTextContent(t.quantityError);
  expect(screen.getByRole("button", { name: t.roll })).toBeDisabled();
  fireEvent.change(screen.getByLabelText(t.quantity(20)), {
    target: { value: "50" },
  });
  fireEvent.change(screen.getByLabelText(t.quantity(100)), {
    target: { value: "50" },
  });
  fireEvent.change(screen.getByLabelText(t.quantity(4)), {
    target: { value: "1" },
  });
  expect(screen.getByRole("alert")).toHaveTextContent(t.totalError);
  expect(diceApi.roll).not.toHaveBeenCalled();
});
test("paginated history recovers from errors without duplicate rows", async () => {
  vi.mocked(diceApi.history)
    .mockRejectedValueOnce(Error("Archivio occupato"))
    .mockResolvedValueOnce({
      rolls: [saved],
      nextCursor: { createdAt: saved.createdAt, id: saved.id },
    })
    .mockResolvedValueOnce({
      rolls: [saved, { ...saved, id: "second", total: 80 }],
      nextCursor: null,
    });
  const user = userEvent.setup();
  render(<DiceWorkspace campaignId="campaign" register={vi.fn()} />);
  await screen.findByRole("alert");
  await user.click(screen.getByRole("button", { name: t.retry }));
  await screen.findByRole("button", { name: t.more });
  await user.click(screen.getByRole("button", { name: t.more }));
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: t.more }),
    ).not.toBeInTheDocument(),
  );
  expect(
    within(
      screen.getByRole("complementary", { name: t.history }),
    ).getAllByLabelText(/^Roll of/),
  ).toHaveLength(2);
});
test("the 2.5-second timeline and skipping do not change the result", async () => {
  motion(false);
  vi.useFakeTimers();
  const done = vi.fn();
  render(<DiceScene roll={saved} animate onDone={done} />);
  expect(screen.getByRole("status")).toHaveTextContent(t.rolling);
  act(() => vi.advanceTimersByTime(1000));
  expect(screen.getByRole("status")).toHaveTextContent(t.landing);
  act(() => vi.advanceTimersByTime(150));
  expect(screen.getByRole("status")).toHaveTextContent(t.burn);
  act(() => vi.advanceTimersByTime(500));
  expect(screen.getByRole("status")).toHaveTextContent(t.reveal);
  act(() => vi.advanceTimersByTime(850));
  expect(done).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("status")).toHaveTextContent(t.saved);
  expect(diceApi.roll).not.toHaveBeenCalled();
});
test("skipping cancels timers and reduced motion bypasses the sequence", async () => {
  motion(false);
  vi.useFakeTimers();
  const done = vi.fn();
  const view = render(<DiceScene roll={saved} animate onDone={done} />);
  fireEvent.click(screen.getByRole("button", { name: t.skip }));
  act(() => vi.advanceTimersByTime(3000));
  expect(done).toHaveBeenCalledTimes(1);
  expect(
    screen.queryByRole("button", { name: t.skip }),
  ).not.toBeInTheDocument();
  view.unmount();
  motion(true);
  render(<DiceScene roll={saved} animate onDone={done} />);
  expect(screen.getByRole("status")).toHaveTextContent(t.reduced);
  act(() => vi.advanceTimersByTime(0));
  expect(done).toHaveBeenCalledTimes(2);
});

test("the roll is saved but history does not reveal it early", async () => {
  motion(false);
  vi.useFakeTimers();
  render(<DiceWorkspace campaignId="campaign" register={vi.fn()} />);
  await act(async () => {});
  fireEvent.change(screen.getByLabelText(t.quantity(6)), {
    target: { value: "3" },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: t.roll }));
  });
  expect(diceApi.roll).toHaveBeenCalledTimes(1);
  expect(screen.getByText(t.awaitingReveal)).toBeInTheDocument();
  const history = screen.getByRole("complementary", { name: t.history });
  expect(within(history).queryByLabelText(/^Roll of/)).not.toBeInTheDocument();
  expect(
    screen.queryByText(t.saved + " · " + t.details),
  ).not.toBeInTheDocument();
  act(() => vi.advanceTimersByTime(2500));
  expect(screen.queryByText(t.awaitingReveal)).not.toBeInTheDocument();
  expect(within(history).getByLabelText(/^Roll of/)).toHaveAccessibleName(
    /Total 136/,
  );
});

test("both dragons react only on reveal with a finite, skippable sequence", () => {
  motion(false);
  vi.useFakeTimers();
  const done = vi.fn();
  const extreme: Roll = {
    ...saved,
    groups: [{ sides: 100, quantity: 1, values: [1], subtotal: 1 }],
    total: 1,
  };
  const view = render(<DiceScene roll={extreme} animate onDone={done} />);
  expect(document.querySelector(".living-dragons")).toBeNull();
  expect(document.querySelector(".dice-scene")).toHaveAttribute(
    "data-outcome",
    "pending",
  );
  act(() => vi.advanceTimersByTime(1650));
  expect(document.querySelector(".dice-scene")).toHaveAttribute(
    "data-outcome",
    "celebration",
  );
  expect(document.querySelectorAll(".living-dragon")).toHaveLength(2);
  expect(screen.getByText(t.best)).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(1950));
  expect(done).toHaveBeenCalledTimes(1);
  expect(document.querySelector(".living-dragons")).toBeNull();
  view.unmount();
  render(
    <DiceScene
      roll={{
        ...extreme,
        total: 100,
        groups: [{ sides: 100, quantity: 1, values: [100], subtotal: 100 }],
      }}
      animate
      onDone={done}
    />,
  );
  act(() => vi.advanceTimersByTime(1650));
  expect(document.querySelector(".dragons-threat")).not.toBeNull();
  fireEvent.click(screen.getByRole("button", { name: t.skip }));
  act(() => vi.advanceTimersByTime(4000));
  expect(document.querySelector(".living-dragons")).toBeNull();
  expect(done).toHaveBeenCalledTimes(2);
});
test("reduced motion keeps a static outcome and replay does not request a new roll", async () => {
  motion(true);
  vi.useFakeTimers();
  const done = vi.fn();
  const extreme: Roll = {
    ...saved,
    groups: [{ sides: 20, quantity: 1, values: [1], subtotal: 1 }],
    total: 1,
  };
  const view = render(<DiceScene roll={extreme} animate onDone={done} />);
  expect(screen.getByText(t.worst)).toBeInTheDocument();
  expect(document.querySelector(".living-dragons")).toBeNull();
  act(() => vi.advanceTimersByTime(0));
  view.unmount();
  motion(false);
  render(<DiceWorkspace campaignId="campaign" register={vi.fn()} />);
  await act(async () => {});
  fireEvent.change(screen.getByLabelText(t.quantity(6)), {
    target: { value: "3" },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: t.roll }));
  });
  act(() => vi.advanceTimersByTime(2500));
  expect(diceApi.roll).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: t.replay }));
  expect(screen.getByText(t.rolling)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: t.skip }));
  expect(diceApi.roll).toHaveBeenCalledTimes(1);
  expect(document.querySelector(".dice-scene")).toHaveAttribute(
    "data-roll-id",
    saved.id,
  );
});
