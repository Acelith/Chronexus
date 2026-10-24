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
test("stato vuoto, tutti i dadi incluso d100 e controlli con mouse", async () => {
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
test("tiro misto azzera tutte le quantità e rende visibili risultati e storico reali", async () => {
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
  await user.click(within(history).getByLabelText(/^Tiro del/));
  expect(
    within(history).getByRole("list", { name: t.results(100) }),
  ).toHaveTextContent("100");
  expect(
    within(history).getByRole("list", { name: t.results(6) }),
  ).toHaveTextContent("624");
  expect(screen.getByRole("button", { name: t.roll })).toBeDisabled();
});
test("errore mantiene la selezione e il retry usa lo stesso ID", async () => {
  const user = userEvent.setup();
  vi.mocked(diceApi.roll).mockRejectedValueOnce(Error("Disco pieno"));
  render(<DiceWorkspace campaignId="campaign" register={vi.fn()} />);
  await screen.findByText(t.noHistory);
  fireEvent.change(screen.getByLabelText(t.quantity(100)), {
    target: { value: "1" },
  });
  await user.click(screen.getByRole("button", { name: t.roll }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Disco pieno");
  expect(screen.getByLabelText(t.quantity(100))).toHaveValue(1);
  const first = vi.mocked(diceApi.roll).mock.calls[0][1];
  await user.click(screen.getByRole("button", { name: t.roll }));
  await waitFor(() => expect(diceApi.roll).toHaveBeenCalledTimes(2));
  expect(vi.mocked(diceApi.roll).mock.calls[1][1]).toBe(first);
  await waitFor(() =>
    expect(screen.getByLabelText(t.quantity(100))).toHaveValue(0),
  );
});
test("invii duplicati bloccati e chiusura attende la registrazione", async () => {
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
test("limiti e quantità frazionarie non inviano richieste", async () => {
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
test("storico paginato si recupera da un errore e non duplica righe", async () => {
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
    ).getAllByLabelText(/^Tiro del/),
  ).toHaveLength(2);
});
test("timeline di 2,5 secondi e salto non cambiano il risultato", async () => {
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
test("salto annulla i timer e movimento ridotto evita la sequenza", async () => {
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

test("il tiro è registrato ma lo storico non anticipa il risultato prima della rivelazione", async () => {
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
  expect(within(history).queryByLabelText(/^Tiro del/)).not.toBeInTheDocument();
  expect(
    screen.queryByText(t.saved + " · " + t.details),
  ).not.toBeInTheDocument();
  act(() => vi.advanceTimersByTime(2500));
  expect(screen.queryByText(t.awaitingReveal)).not.toBeInTheDocument();
  expect(within(history).getByLabelText(/^Tiro del/)).toHaveAccessibleName(
    /Totale 136/,
  );
});
