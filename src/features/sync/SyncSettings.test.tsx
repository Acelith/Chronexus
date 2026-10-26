import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { command } from "../journal/api";
import SyncSettings from "./SyncSettings";
vi.mock("../journal/api", async (original) => ({
  ...(await original<typeof import("../journal/api")>()),
  command: vi.fn(),
}));
const blank = {
  server: null,
  signedIn: false,
  accountId: null,
  username: null,
  displayName: null,
  device: null,
};
const signed = {
  server: "https://sync.example.org",
  signedIn: true,
  accountId: "acc-1",
  username: "gina",
  displayName: "Gina",
  device: "Chronexus desktop",
};
beforeEach(() => {
  vi.mocked(command).mockReset();
  vi.mocked(command).mockImplementation(async (name: string) => {
    switch (name) {
      case "sync_account":
        return blank as never;
      case "sync_set_server":
        return { ...blank, server: "https://sync.example.org" } as never;
      case "sync_redeem_invite":
        return signed as never;
      case "sync_sign_out":
        return { ...blank, server: "https://sync.example.org" } as never;
      default:
        throw Error(`Unexpected command: ${name}`);
    }
  });
});
test("nothing is contacted until the user verifies a server, then invites create the account", async () => {
  const user = userEvent.setup();
  render(<SyncSettings disabled={false} />);
  await screen.findByLabelText("Server address (HTTPS)");
  expect(command).toHaveBeenCalledTimes(1);
  expect(command).toHaveBeenCalledWith("sync_account");
  await user.type(
    screen.getByLabelText("Server address (HTTPS)"),
    "https://sync.example.org",
  );
  await user.click(
    screen.getByRole("button", { name: "Verify and save server" }),
  );
  expect(command).toHaveBeenCalledWith("sync_set_server", {
    server: "https://sync.example.org",
  });
  await user.click(
    await screen.findByRole("radio", { name: "I have an invitation code" }),
  );
  await user.type(screen.getByLabelText("Invitation code"), "JOIN-1");
  await user.type(screen.getByLabelText("Name shown to other players"), "Gina");
  await user.type(screen.getByLabelText("User name"), "gina");
  await user.type(screen.getByLabelText("Password"), "correct horse battery");
  await user.click(
    screen.getByRole("button", { name: "Create account with invitation" }),
  );
  expect(command).toHaveBeenCalledWith("sync_redeem_invite", {
    code: "JOIN-1",
    username: "gina",
    displayName: "Gina",
    password: "correct horse battery",
    device: "Chronexus desktop",
  });
  expect(await screen.findByText(/Signed in to .* as Gina/)).toBeVisible();
  expect(screen.queryByLabelText("Password")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Sign out" }));
  expect(await screen.findByText(/Signed out/)).toBeVisible();
});
