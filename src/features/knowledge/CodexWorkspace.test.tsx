import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import CodexWorkspace from "./CodexWorkspace";
import type { KnowledgePage } from "./api";
vi.mock("../journal/Editor", () => ({ default: () => null }));
vi.mock("../images/ImageGallery", () => ({ default: () => null }));
vi.mock("./api", async (original) => ({
  ...(await original<typeof import("./api")>()),
  knowledgeApi: { backlinks: vi.fn().mockResolvedValue([]) },
}));
test("preserva bozza e snapshot metadati durante un aggiornamento esterno", async () => {
  const user = userEvent.setup();
  const page: KnowledgePage = {
    id: "page",
    campaignId: "campaign",
    title: "Titolo originale",
    kind: "note",
    status: "active",
    aliases: [],
    document: { version: 1, blocks: [] },
    revision: 0,
    updatedAt: "2026-10-25",
  };
  const onUpdate = vi.fn().mockResolvedValue(undefined);
  const props = {
    campaignId: "campaign",
    pages: [page],
    selectedId: "page",
    fallback: "",
    busy: false,
    register: vi.fn(),
    onSelect: vi.fn(),
    onSource: vi.fn(),
    onSaved: vi.fn(),
    onCreate: vi.fn(),
    onUpdate,
    onRecover: vi.fn(),
  };
  const view = render(<CodexWorkspace {...props} />);
  await user.click(screen.getByRole("button", { name: "Edit page" }));
  const input = screen.getByDisplayValue("Titolo originale");
  await user.clear(input);
  await user.type(input, "Bozza locale");
  view.rerender(
    <CodexWorkspace
      {...props}
      pages={[{ ...page, title: "Modifica AI" }]}
      externalEpoch={1}
    />,
  );
  expect(screen.getByDisplayValue("Bozza locale")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Save page" }));
  expect(onUpdate).toHaveBeenCalledWith(
    "page",
    { title: "Bozza locale", kind: "note", status: "active", aliases: [] },
    { title: "Titolo originale", kind: "note", status: "active", aliases: [] },
  );
  expect(screen.getByDisplayValue("Bozza locale")).toBeInTheDocument();
});
