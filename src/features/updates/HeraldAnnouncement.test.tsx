import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import HeraldAnnouncement from "./HeraldAnnouncement";
import { heraldApi } from "./api";
import {
  IDLE_POLL_MS,
  STARTUP_DELAY_MS,
  useStartupHerald,
} from "./useStartupHerald";
vi.mock("./api", () => ({
  heraldApi: {
    startupCheck: vi.fn(),
    blocked: vi.fn(),
    record: vi.fn(),
  },
}));
const announcement = {
  offer: {
    id: "o1",
    version: "0.5.0",
    notes: "Novità <script>alert(1)</script>",
  },
  sound: true,
};
function motion(reduced: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduced && query.includes("reduce"),
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}
beforeEach(() => {
  vi.resetAllMocks();
  motion(false);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
test("annuncio leggibile e accessibile; le azioni non installano nulla", async () => {
  const user = userEvent.setup();
  const props = {
    onUpdate: vi.fn(),
    onLater: vi.fn(),
    onDismiss: vi.fn(),
    onSound: vi.fn(async () => {}),
  };
  const opener = document.createElement("button");
  document.body.append(opener);
  opener.focus();
  const { unmount } = render(
    <HeraldAnnouncement announcement={announcement} {...props} />,
  );
  const heading = screen.getByRole("heading", {
    name: "Chronexus 0.5.0 è disponibile",
  });
  expect(heading).toHaveFocus();
  // Notes are plain text: markup is shown, never executed.
  expect(screen.getByText(/<script>alert\(1\)<\/script>/)).toBeInTheDocument();
  expect(document.querySelector("dialog script")).toBeNull();
  // jsdom has no Web Audio: the visual announcement stays complete.
  expect(
    await screen.findByText(/non ha permesso l’audio automatico/),
  ).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Salta animazione" }));
  expect(screen.queryByRole("button", { name: "Salta animazione" })).toBeNull();
  await user.click(
    screen.getByRole("button", { name: "Suono della trombetta: attivo" }),
  );
  expect(props.onSound).toHaveBeenCalledWith(false);
  expect(
    screen.getByRole("button", { name: "Suono della trombetta: disattivato" }),
  ).toHaveAttribute("aria-pressed", "false");
  fireEvent(
    document.querySelector("dialog")!,
    new Event("cancel", { cancelable: true }),
  );
  expect(props.onLater).toHaveBeenCalledTimes(1);
  await user.click(
    screen.getByRole("button", { name: "Ignora questa versione" }),
  );
  await user.click(screen.getByRole("button", { name: "Aggiorna" }));
  expect(props.onDismiss).toHaveBeenCalledTimes(1);
  expect(props.onUpdate).toHaveBeenCalledTimes(1);
  unmount();
  expect(opener).toHaveFocus();
  opener.remove();
});
test("movimento ridotto: nessuna animazione da saltare", () => {
  motion(true);
  render(
    <HeraldAnnouncement
      announcement={{ ...announcement, sound: false }}
      onUpdate={vi.fn()}
      onLater={vi.fn()}
      onDismiss={vi.fn()}
      onSound={vi.fn(async () => {})}
    />,
  );
  expect(document.querySelector("dialog")).toHaveClass("herald-still");
  expect(screen.queryByRole("button", { name: "Salta animazione" })).toBeNull();
  expect(screen.queryByText(/audio automatico/)).toBeNull();
});
test("un solo controllo all’avvio; l’annuncio aspetta un’app inattiva", async () => {
  vi.useFakeTimers();
  vi.mocked(heraldApi.startupCheck).mockResolvedValue(announcement);
  vi.mocked(heraldApi.blocked).mockResolvedValue(false);
  vi.mocked(heraldApi.record).mockResolvedValue(undefined);
  let idle = false;
  const { result } = renderHook(() => useStartupHerald(() => idle));
  expect(heraldApi.startupCheck).not.toHaveBeenCalled();
  await act(() => vi.advanceTimersByTimeAsync(STARTUP_DELAY_MS));
  expect(heraldApi.startupCheck).toHaveBeenCalledTimes(1);
  await act(() => vi.advanceTimersByTimeAsync(IDLE_POLL_MS * 3));
  expect(result.current.announcement).toBeNull();
  // Typing in a field also postpones it, even when the app is otherwise idle.
  idle = true;
  const field = document.createElement("textarea");
  document.body.append(field);
  field.focus();
  await act(() => vi.advanceTimersByTimeAsync(IDLE_POLL_MS * 2));
  expect(result.current.announcement).toBeNull();
  field.remove();
  // A focused select (the campaign picker at startup) is not typing.
  const picker = document.createElement("select");
  document.body.append(picker);
  picker.focus();
  vi.mocked(heraldApi.blocked).mockResolvedValueOnce(true);
  await act(() => vi.advanceTimersByTimeAsync(IDLE_POLL_MS));
  expect(result.current.announcement).toBeNull();
  await act(() => vi.advanceTimersByTimeAsync(IDLE_POLL_MS));
  expect(result.current.announcement?.offer.version).toBe("0.5.0");
  picker.remove();
  act(() => result.current.close("later"));
  expect(heraldApi.record).toHaveBeenCalledWith("0.5.0", "later");
  expect(result.current.announcement).toBeNull();
  await act(() => vi.advanceTimersByTimeAsync(IDLE_POLL_MS * 5));
  expect(result.current.announcement).toBeNull();
  expect(heraldApi.startupCheck).toHaveBeenCalledTimes(1);
});
test("nessun annuncio se il controllo non trova novità o fallisce", async () => {
  vi.useFakeTimers();
  vi.mocked(heraldApi.startupCheck).mockRejectedValue(Error("offline"));
  const { result } = renderHook(() => useStartupHerald(() => true));
  await act(() =>
    vi.advanceTimersByTimeAsync(STARTUP_DELAY_MS + IDLE_POLL_MS * 3),
  );
  expect(result.current.announcement).toBeNull();
  expect(heraldApi.blocked).not.toHaveBeenCalled();
});
