import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { command } from "../journal/api";
import type { KnowledgePage } from "../knowledge/api";
import type { SaveGuard } from "../journal/Editor";
import PartyWorkspace from "./PartyWorkspace";
vi.mock("../journal/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../journal/api")>()),
  command: vi.fn(),
}));
vi.mock("../journal/Editor", () => ({
  default: () => <p>Appunti condivisi</p>,
}));
vi.mock("../images/ImageGallery", () => ({ default: () => null }));
const page: KnowledgePage = {
  id: "p",
  campaignId: "c",
  title: "Compagno",
  kind: "npc",
  status: "active",
  aliases: [],
  revision: 0,
  updatedAt: "",
  document: { version: 1, blocks: [] },
};
beforeEach(() => vi.resetAllMocks());
test("party links an existing character and keeps failed edits guarded and recoverable", async () => {
  const user = userEvent.setup(),
    register = vi.fn(),
    onSaved = vi.fn();
  vi.mocked(command).mockImplementation(async (name) => {
    if (name === "list_party") return [];
    throw Error("Disco pieno");
  });
  render(
    <PartyWorkspace
      campaignId="c"
      pages={[page]}
      register={register}
      onSaved={onSaved}
      onOpen={vi.fn()}
    />,
  );
  await screen.findByText("Chi viaggia con te?");
  await user.click(screen.getByRole("button", { name: "Aggiungi membro" }));
  await user.selectOptions(
    screen.getByLabelText("Pagina del personaggio"),
    "p",
  );
  await user.type(
    screen.getByLabelText("Ruolo nella compagnia"),
    "Esploratore",
  );
  const guard = register.mock.calls[0][0] as SaveGuard;
  expect(guard.dirty()).toBe(true);
  await expect(guard.flush()).rejects.toThrow("Salva o annulla");
  await user.click(screen.getByRole("button", { name: "Salva membro" }));
  await screen.findByText("Disco pieno");
  expect(screen.getByLabelText("Ruolo nella compagnia")).toHaveValue(
    "Esploratore",
  );
  expect(onSaved).not.toHaveBeenCalled();
  vi.mocked(command).mockResolvedValue({
    page,
    playerName: "",
    role: "Esploratore",
    status: "active",
    revision: 0,
  });
  await user.click(screen.getByRole("button", { name: "Salva membro" }));
  await screen.findByText("Appunti condivisi");
  expect(onSaved).toHaveBeenCalledWith(page);
  expect(guard.dirty()).toBe(false);
});
