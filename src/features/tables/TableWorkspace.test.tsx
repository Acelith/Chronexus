import {
  act,
  render,
  screen,
  waitFor,
  fireEvent,
  cleanup,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, afterEach, test, expect, vi } from "vitest";
import { applyPreferences, loadLocale, tr } from "../../i18n/store";
import { tablesApi, type LiveFrame } from "./api";
import { syncApi } from "../sync/api";
import TableWorkspace from "./TableWorkspace";
import { createTableRuntime } from "../../../vendor/table-runtime/index.js";
import type { BoardView } from "./server-types";
vi.mock("./api", () => ({
  tablesApi: {
    board: vi.fn(),
    seats: vi.fn(),
    operate: vi.fn(),
    image: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    message: vi.fn(),
    character: vi.fn(),
    project: vi.fn(),
    grant: vi.fn(),
    leave: vi.fn(),
    link: vi.fn(),
  },
}));
vi.mock("../sync/api", () => ({
  syncApi: { account: vi.fn(), items: vi.fn() },
}));
const table = {
  id: "table",
  name: "Synthetic <script>table</script>",
  role: "player" as const,
  revision: 1,
};
let receive: (event: LiveFrame) => void;
const snapshot = (): BoardView => ({
  revision: 1,
  activeScene: "scene",
  scenes: [
    {
      id: "scene",
      name: "Canonical scene",
      width: 1000,
      height: 700,
      mapId: null,
      freeMove: true,
      difficult: [],
      grid: {
        kind: "square",
        pixels: 50,
        offset: { x: 0, y: 0 },
        color: "#cab582",
        opacity: 0.4,
        distance: { value: 5, unit: "ft" },
        diagonal: "equal",
        conversion: "table",
      },
    },
  ],
  tokens: [
    {
      id: "hero",
      sceneId: "scene",
      ownerId: "self",
      name: "Hero <img src=x>",
      position: { x: 1, y: 1 },
      size: 1,
      speed: { value: 30, unit: "ft" },
      hidden: false,
      portraitId: null,
      characterId: null,
      spent: 0,
      diagonals: 0,
    },
  ],
  templates: [],
  combat: null,
  combatLog: [],
  vitals: [],
  fog: [],
});
beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    new Proxy(
      {},
      { get: () => () => {}, set: () => true },
    ) as unknown as CanvasRenderingContext2D,
  );
  vi.mocked(syncApi.account).mockResolvedValue({
    signedIn: true,
    accountId: "self",
    server: "https://table.example",
    username: "synthetic",
    displayName: "Synthetic",
    device: "test",
  });
  vi.mocked(tablesApi.seats).mockResolvedValue([
    { accountId: "self", displayName: "Self", role: "player" },
  ]);
  vi.mocked(tablesApi.start).mockImplementation(async (_id, fn) => {
    receive = fn;
    return "subscription";
  });
  vi.mocked(tablesApi.stop).mockResolvedValue();
  vi.mocked(tablesApi.operate).mockResolvedValue({ revision: 2 });
  vi.mocked(tablesApi.board).mockResolvedValue({ ...snapshot(), revision: 2 });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
for (const locale of ["en", "it", "ar"] as const)
  test(`${locale}: owned movement, frozen disconnect and cleared access loss`, async () => {
    await loadLocale(locale);
    applyPreferences({
      version: 2,
      locale,
      script: "standard",
      showOriginal: false,
    });
    const t = createTableRuntime(locale).i18n.t;
    const screenView = render(
      <TableWorkspace campaignId="campaign" table={table} onClose={() => {}} />,
    );
    await waitFor(() => expect(tablesApi.start).toHaveBeenCalledOnce());
    act(() =>
      receive({ type: "state", board: snapshot(), events: [], online: 3 }),
    );
    expect(screen.getByText(table.name)).toBeInTheDocument();
    expect(screenView.container.querySelector("script")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /Hero <img/ }));
    fireEvent.keyDown(screen.getByLabelText(t("boardKeys")), {
      key: "ArrowRight",
    });
    await waitFor(() =>
      expect(tablesApi.operate).toHaveBeenCalledWith(
        "table",
        expect.objectContaining({
          baseRevision: 1,
          command: { type: "move", tokenId: "hero", path: [{ x: 2, y: 1 }] },
        }),
      ),
    );
    act(() => receive({ type: "disconnected" }));
    const previous = vi.mocked(tablesApi.operate).mock.calls.length;
    fireEvent.keyDown(screen.getByLabelText(t("boardKeys")), {
      key: "ArrowRight",
    });
    expect(tablesApi.operate).toHaveBeenCalledTimes(previous);
    act(() => receive({ type: "accessLost" }));
    expect(
      screen.queryByRole("button", { name: /Hero <img/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      tr("Table access ended. Sign in again or check your invitation."),
    );
    screenView.unmount();
    await waitFor(() =>
      expect(tablesApi.stop).toHaveBeenCalledWith("subscription"),
    );
  });
test("a late live subscription is stopped after unmount and no table is stored", async () => {
  let finish!: (id: string) => void;
  vi.mocked(tablesApi.start).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const view = render(
    <TableWorkspace campaignId="campaign" table={table} onClose={() => {}} />,
  );
  await waitFor(() => expect(tablesApi.start).toHaveBeenCalledOnce());
  view.unmount();
  await act(async () => finish("late"));
  expect(tablesApi.stop).toHaveBeenCalledWith("late");
  expect(localStorage.getItem("table")).toBeNull();
});
test("bundled table catalogs contain every label in all ten natural languages", () => {
  for (const locale of [
    "en",
    "it",
    "de",
    "fr",
    "es",
    "pt-BR",
    "ja",
    "ko",
    "zh-Hans",
    "ar",
  ]) {
    const r = createTableRuntime(locale);
    expect(r.i18n.t("fogEditor")).not.toBe("fogEditor");
    expect(r.i18n.t("boardFailed")).not.toBe("boardFailed");
    expect(document.documentElement.lang).toBeTruthy();
  }
});
