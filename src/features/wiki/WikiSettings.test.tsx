import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { command } from "../journal/api";
import WikiSettings from "./WikiSettings";
import { WIKI_CHANGED } from "./provider";
vi.mock("../journal/api", async (original) => ({
  ...(await original<typeof import("../journal/api")>()),
  command: vi.fn(),
}));
const summary = {
  open5e: { entries: 3, bytes: 4096, aiSources: 0 },
  wikidot: { entries: 5, bytes: 10240, aiSources: 2 },
};
const empty = {
  open5e: { entries: 3, bytes: 4096, aiSources: 0 },
  wikidot: { entries: 0, bytes: 0, aiSources: 0 },
};
beforeEach(() => {
  vi.mocked(command).mockReset();
  vi.mocked(command).mockImplementation(
    async (name: string, args?: unknown) => {
      switch (name) {
        case "get_wiki_provider":
          return { provider: "wikidot", explicit: false } as never;
        case "wiki_cache_summary":
          return summary as never;
        case "save_wiki_provider":
          return { ...(args as object), explicit: true } as never;
        case "clear_wiki_cache":
          return empty as never;
        default:
          throw Error(`Unexpected command: ${name}`);
      }
    },
  );
});
test("shows the Wikidot default and saves an explicit choice without a campaign", async () => {
  const user = userEvent.setup();
  const changed = vi.fn();
  window.addEventListener(WIKI_CHANGED, changed);
  render(<WikiSettings disabled={false} />);
  expect(
    await screen.findByText(
      /No choice saved: the default Wikidot source is active/,
    ),
  ).toBeVisible();
  expect(screen.getByRole("radio", { name: /Wikidot D&D 5e/ })).toBeChecked();
  await user.click(screen.getByRole("radio", { name: /Open5e/ }));
  expect(command).toHaveBeenCalledWith("save_wiki_provider", {
    provider: "open5e",
  });
  expect(await screen.findByText("Wiki source saved: Open5e.")).toBeVisible();
  expect(changed).toHaveBeenCalledTimes(1);
  window.removeEventListener(WIKI_CHANGED, changed);
});
test("clearing cache requires confirmation, warns about AI sources and can be cancelled", async () => {
  const user = userEvent.setup();
  render(<WikiSettings disabled={false} />);
  await screen.findByText(/Wikidot D&D 5e · cached entries: 5/);
  const open = screen.getByRole("button", { name: "Clear offline cache…" });
  await user.click(open);
  const dialog = screen.getByRole("alertdialog", {
    name: "Clear Wikidot D&D 5e?",
  });
  expect(dialog).toHaveTextContent("5 viewed copies");
  expect(dialog).toHaveTextContent("2 rules sources approved");
  expect(screen.getByRole("button", { name: "Clear cache" })).toHaveFocus();
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  expect(open).toHaveFocus();
  await user.click(open);
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  expect(
    vi.mocked(command).mock.calls.some(([n]) => n === "clear_wiki_cache"),
  ).toBe(false);
  await user.click(open);
  await user.click(screen.getByRole("button", { name: "Clear cache" }));
  expect(command).toHaveBeenCalledWith("clear_wiki_cache", {
    provider: "wikidot",
  });
  expect(
    await screen.findByText("Cache cleared: Wikidot D&D 5e."),
  ).toBeVisible();
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Clear offline cache…" }),
    ).toBeDisabled(),
  );
  expect(
    screen.getByText("The selected cache is already empty."),
  ).toBeVisible();
  await user.selectOptions(screen.getByLabelText("Cache to clear"), "all");
  expect(
    screen.getByRole("button", { name: "Clear offline cache…" }),
  ).toBeEnabled();
});
test("a cache-clear error stays visible and preserves the summary", async () => {
  const user = userEvent.setup();
  const base = vi.mocked(command).getMockImplementation()!;
  vi.mocked(command).mockImplementation(async (name, args) => {
    if (name === "clear_wiki_cache") throw Error("Archive busy.");
    return base(name, args);
  });
  render(<WikiSettings disabled={false} />);
  await screen.findByText(/Wikidot D&D 5e · cached entries: 5/);
  await user.click(
    screen.getByRole("button", { name: "Clear offline cache…" }),
  );
  await user.click(screen.getByRole("button", { name: "Clear cache" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Archive busy.");
  expect(screen.getByText(/Wikidot D&D 5e · cached entries: 5/)).toBeVisible();
});
