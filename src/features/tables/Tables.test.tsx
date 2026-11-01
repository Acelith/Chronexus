import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, test, expect, vi } from "vitest";
import Tables from "./Tables";
import { tablesApi } from "./api";
import { syncApi } from "../sync/api";
import { applyPreferences } from "../../i18n/store";
vi.mock("./api", () => ({
  tablesApi: { list: vi.fn(), join: vi.fn(), links: vi.fn(), link: vi.fn() },
}));
vi.mock("../sync/api", () => ({ syncApi: { account: vi.fn() } }));
vi.mock("./TableDock", () => ({ useTableDock: () => vi.fn() }));
beforeEach(() => {
  vi.resetAllMocks();
  applyPreferences({
    version: 2,
    locale: "en",
    script: "standard",
    showOriginal: false,
  });
  vi.mocked(tablesApi.list).mockResolvedValue([]);
  vi.mocked(tablesApi.links).mockResolvedValue([]);
  vi.mocked(syncApi.account).mockResolvedValue({
    server: "https://table.example",
    signedIn: true,
    accountId: "self",
    username: "self",
    displayName: "Self",
    device: "test",
  });
});
test("opening the campaign never contacts a table until explicitly requested", async () => {
  render(<Tables campaignId="campaign" />);
  expect(tablesApi.list).not.toHaveBeenCalled();
  expect(tablesApi.join).not.toHaveBeenCalled();
  await userEvent.click(screen.getByText("Tables", { selector: "summary" }));
  await userEvent.click(screen.getByRole("button", { name: "Load tables" }));
  expect(
    await screen.findByText("No tables yet. Join with an invitation code."),
  ).toBeInTheDocument();
  expect(tablesApi.links).toHaveBeenCalledWith("campaign");
});
test("joining sends only the code and displays inert table names", async () => {
  const joined = {
    id: "table",
    name: "<img src=x onerror=bad()>",
    role: "player" as const,
    revision: 1,
  };
  vi.mocked(tablesApi.join).mockResolvedValue(joined);
  vi.mocked(tablesApi.list).mockResolvedValue([joined]);
  const view = render(<Tables campaignId="private-campaign" />);
  await userEvent.click(screen.getByText("Tables", { selector: "summary" }));
  await userEvent.type(screen.getByLabelText("Invitation code"), "public-code");
  await userEvent.click(screen.getByRole("button", { name: "Join table" }));
  await waitFor(() =>
    expect(tablesApi.join).toHaveBeenCalledWith("public-code"),
  );
  expect(await screen.findByText(joined.name)).toBeInTheDocument();
  expect(view.container.querySelector("img")).toBeNull();
});
