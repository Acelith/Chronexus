import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import SearchPanel from "./SearchPanel";
import { command } from "../journal/api";
vi.mock("../journal/api", async (original) => ({
  ...(await original<typeof import("../journal/api")>()),
  command: vi.fn(),
}));
beforeEach(() => {
  vi.mocked(command).mockReset();
});
test("search uses campaign filters and opens an exact source block; keyboard closes", async () => {
  const user = userEvent.setup(),
    select = vi.fn(),
    close = vi.fn();
  vi.mocked(command).mockResolvedValue([
    {
      kind: "session",
      sourceId: "s",
      blockId: "block",
      title: "La torre",
      preview: "Chiave nella torre",
      updatedAt: "2026-10-23",
    },
  ]);
  render(
    <SearchPanel campaignId="campaign-a" onSelect={select} onClose={close} />,
  );
  await user.type(screen.getByLabelText("Text to search"), "chiave");
  await screen.findByRole("button", { name: /La torre/ });
  await waitFor(() =>
    expect(command).toHaveBeenLastCalledWith("search_campaign", {
      campaignId: "campaign-a",
      query: "chiave",
      kind: null,
      sort: "relevance",
    }),
  );
  await user.click(screen.getByRole("button", { name: /La torre/ }));
  expect(select).toHaveBeenCalledWith(
    expect.objectContaining({ sourceId: "s", blockId: "block" }),
  );
  await user.keyboard("{Escape}");
  expect(close).toHaveBeenCalled();
});
test("search errors retain input and rebuild failures are visible", async () => {
  const user = userEvent.setup();
  vi.mocked(command).mockRejectedValue(Error("Archivio occupato"));
  render(<SearchPanel campaignId="a" onSelect={vi.fn()} onClose={vi.fn()} />);
  await user.type(screen.getByLabelText("Text to search"), "memoria");
  await screen.findByRole("alert");
  expect(screen.getByLabelText("Text to search")).toHaveValue("memoria");
  await user.click(screen.getByText("Search maintenance"));
  await user.click(screen.getByRole("button", { name: "Rebuild local index" }));
  await waitFor(() =>
    expect(command).toHaveBeenLastCalledWith("rebuild_search_index"),
  );
  expect(screen.getByRole("alert")).toHaveTextContent("Archivio occupato");
});
