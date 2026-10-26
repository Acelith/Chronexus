import { render, screen, within } from "@testing-library/react";
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

test("Italian account deletion confirmation is localized without changing account data", async () => {
  const { applyPreferences } = await import("../../i18n/store");
  const { defaultPreferences } = await import("../../i18n/locales");
  applyPreferences({ ...defaultPreferences, locale: "it" });
  vi.mocked(command).mockImplementation(async (name: string) => {
    if (name === "sync_account") return signed as never;
    throw Error(`Unexpected command: ${name}`);
  });
  const view = render(<SyncSettings disabled={false} />);
  try {
    const user = userEvent.setup();
    expect(
      await screen.findByRole("heading", { name: "Campagne sul server" }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Elimina il mio account dal server" }),
    );
    const dialog = screen.getByRole("alertdialog", {
      name: "Elimina il mio account",
    });
    expect(
      within(dialog).getByText(
        /Le tue campagne rimangono su questo dispositivo/,
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", {
        name: "Elimina definitivamente il mio account",
      }),
    ).toBeInTheDocument();
    expect(signed.username).toBe("gina");
    expect(command).not.toHaveBeenCalledWith(
      "sync_delete_account",
      expect.anything(),
    );
  } finally {
    view.unmount();
    applyPreferences(defaultPreferences);
  }
});

test("deleting the account needs the password and says that campaigns stay on this device", async () => {
  const user = userEvent.setup();
  vi.mocked(command).mockImplementation(
    async (name: string, args?: unknown) => {
      switch (name) {
        case "sync_account":
          return signed as never;
        case "sync_delete_account":
          expect(args).toEqual({
            password: "correct horse battery",
            deleteOwnedCampaigns: true,
          });
          return { ...blank, server: "https://sync.example.org" } as never;
        default:
          throw Error(`Unexpected command: ${name}`);
      }
    },
  );
  render(<SyncSettings disabled={false} />);
  await user.click(
    await screen.findByRole("button", {
      name: "Delete my account on the server",
    }),
  );
  const dialog = screen.getByRole("alertdialog", { name: "Delete my account" });
  expect(
    within(dialog).getByText(/Your campaigns stay on this device/),
  ).toBeVisible();
  const confirm = within(dialog).getByRole("button", {
    name: "Delete my account permanently",
  });
  expect(confirm).toBeDisabled();
  await user.type(
    within(dialog).getByLabelText("Password"),
    "correct horse battery",
  );
  await user.click(
    within(dialog).getByLabelText(/Also delete the campaigns I own/),
  );
  await user.click(confirm);
  expect(
    await screen.findByText(/Your account on the server was deleted/),
  ).toBeVisible();
  expect(screen.queryByRole("alertdialog")).toBeNull();
});
