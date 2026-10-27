import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { command } from "../journal/api";
import CampaignMembers from "./CampaignMembers";
import type { SyncLink } from "./api";
vi.mock("../journal/api", async (original) => ({
  ...(await original<typeof import("../journal/api")>()),
  command: vi.fn(),
}));
const link = (role: SyncLink["role"]): SyncLink => ({
  campaignId: "c1",
  server: "https://sync.example.org",
  remoteId: "camp-1",
  accountId: "acc-1",
  role,
  cursor: "",
  syncedAt: null,
  auto: true,
  paused: false,
  lastError: null,
  accessLost: false,
});
let members = [
  {
    accountId: "acc-1",
    displayName: "Alice",
    role: "owner",
    revision: 1,
    joinedAt: "",
  },
  {
    accountId: "acc-2",
    displayName: "Bob",
    role: "player",
    revision: 3,
    joinedAt: "",
  },
];
beforeEach(() => {
  members = [
    {
      accountId: "acc-1",
      displayName: "Alice",
      role: "owner",
      revision: 1,
      joinedAt: "",
    },
    {
      accountId: "acc-2",
      displayName: "Bob",
      role: "player",
      revision: 3,
      joinedAt: "",
    },
  ];
  vi.mocked(command).mockReset();
  vi.mocked(command).mockImplementation(
    async (name: string, args?: unknown) => {
      const a = args as { role?: string; accountId?: string };
      switch (name) {
        case "sync_members":
          return members as never;
        case "sync_change_member":
          members = members.map((m) =>
            m.accountId === a.accountId
              ? { ...m, role: a.role!, revision: m.revision + 1 }
              : m,
          );
          return members as never;
        case "sync_remove_member":
          members = members.filter((m) => m.accountId !== a.accountId);
          return members as never;
        case "sync_leave_campaign":
          return { ...link("player"), auto: false, accessLost: true } as never;
        default:
          throw Error(`unexpected ${name}`);
      }
    },
  );
});
const act = async (action: () => Promise<string | void>) => {
  await action();
};

test("nothing is asked of the server until the owner opens the list", async () => {
  const user = userEvent.setup();
  render(
    <CampaignMembers
      campaignId="c1"
      link={link("owner")}
      disabled={false}
      act={act}
      onLink={() => {}}
    />,
  );
  expect(command).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Show the members" }));
  expect(await screen.findByText("Alice")).toBeTruthy();
  expect(screen.getByText(/· you/)).toBeTruthy();
  // The owner's own role is not editable; the other member's is.
  expect(screen.getAllByRole("combobox")).toHaveLength(1);
});

test("the owner changes a role with the listed revision and confirms a removal", async () => {
  const user = userEvent.setup();
  render(
    <CampaignMembers
      campaignId="c1"
      link={link("owner")}
      disabled={false}
      act={act}
      onLink={() => {}}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Show the members" }));
  await user.selectOptions(
    await screen.findByRole("combobox", { name: "Role of Bob" }),
    "reader",
  );
  expect(command).toHaveBeenCalledWith("sync_change_member", {
    campaignId: "c1",
    accountId: "acc-2",
    role: "reader",
    revision: 3,
  });
  await user.click(
    screen.getByRole("button", { name: "Remove from the campaign" }),
  );
  // Nothing is removed before the confirmation.
  expect(command).not.toHaveBeenCalledWith(
    "sync_remove_member",
    expect.anything(),
  );
  const dialog = screen.getByRole("alertdialog");
  expect(dialog.textContent).toContain("Remove Bob from the campaign?");
  await user.click(screen.getByRole("button", { name: "Remove" }));
  expect(command).toHaveBeenCalledWith("sync_remove_member", {
    campaignId: "c1",
    accountId: "acc-2",
    revision: 4,
  });
  expect(screen.queryByText("Bob")).toBeNull();
});

test("a player can leave only after confirming, and cannot edit roles", async () => {
  const user = userEvent.setup();
  const onLink = vi.fn();
  render(
    <CampaignMembers
      campaignId="c1"
      link={link("player")}
      disabled={false}
      act={act}
      onLink={onLink}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Show the members" }));
  await screen.findByText("Bob");
  expect(screen.queryByRole("combobox")).toBeNull();
  expect(
    screen.queryByRole("button", { name: "Remove from the campaign" }),
  ).toBeNull();
  await user.click(screen.getByRole("button", { name: "Leave the campaign" }));
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(command).not.toHaveBeenCalledWith(
    "sync_leave_campaign",
    expect.anything(),
  );
  await user.click(screen.getByRole("button", { name: "Leave the campaign" }));
  await user.click(screen.getByRole("button", { name: "Leave" }));
  expect(command).toHaveBeenCalledWith("sync_leave_campaign", {
    campaignId: "c1",
  });
  expect(onLink).toHaveBeenCalledWith(
    expect.objectContaining({ accessLost: true }),
  );
});
