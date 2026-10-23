import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import DndCatalog from "./DndCatalog";
import { loadCatalog } from "./catalog";
vi.mock("./catalog", async (original) => ({
  ...(await original<typeof import("./catalog")>()),
  loadCatalog: vi.fn(),
}));
beforeEach(() => {
  vi.mocked(loadCatalog).mockReset();
});
test("does not search on opening; name and level filter locally; import requires preview action", async () => {
  const user = userEvent.setup();
  const onImport = vi.fn();
  const result = {
    fetchedAt: "2026-10-23T00:00:00Z",
    cached: true,
    warning: "",
  };
  vi.mocked(loadCatalog)
    .mockResolvedValueOnce({
      ...result,
      payload: {
        results: [
          { index: "light-test", name: "Light Test", level: 0 },
          { index: "test-spell", name: "Test Spell", level: 1 },
        ],
      },
    })
    .mockResolvedValueOnce({
      ...result,
      payload: {
        index: "test-spell",
        name: "Test Spell",
        desc: ["Descrizione prova"],
        level: 1,
      },
    });
  render(<DndCatalog onImport={onImport} onClose={vi.fn()} />);
  expect(loadCatalog).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Cerca nell’API" }));
  await screen.findByRole("button", { name: /Light Test/ });
  await user.type(screen.getByLabelText("Nome nel catalogo"), "Test Spell");
  expect(
    screen.queryByRole("button", { name: /Light Test/ }),
  ).not.toBeInTheDocument();
  expect(loadCatalog).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole("button", { name: /Test Spell/ }));
  await screen.findByText("Descrizione prova");
  expect(onImport).not.toHaveBeenCalled();
  await user.click(
    screen.getByRole("button", { name: "Usa questi dati nel modulo" }),
  );
  expect(onImport).toHaveBeenCalledWith(
    expect.objectContaining({
      name: "Test Spell",
      catalogSource: { path: "spells/test-spell", name: "Test Spell" },
    }),
  );
});
test("failed catalog lookup retains query and permits retry", async () => {
  const user = userEvent.setup();
  vi.mocked(loadCatalog).mockRejectedValue(Error("Connessione assente"));
  render(<DndCatalog initialQuery="Mio incantesimo" onClose={vi.fn()} />);
  await user.click(screen.getByRole("button", { name: "Cerca nell’API" }));
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent("Connessione assente"),
  );
  expect(screen.getByLabelText("Nome nel catalogo")).toHaveValue(
    "Mio incantesimo",
  );
  expect(screen.getByRole("button", { name: "Cerca nell’API" })).toBeEnabled();
});
