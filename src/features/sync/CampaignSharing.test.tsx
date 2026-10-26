import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { command } from "../journal/api";
import CampaignSharing from "./CampaignSharing";
vi.mock("../journal/api", async (original) => ({
  ...(await original<typeof import("../journal/api")>()),
  command: vi.fn(),
}));
const link = {
  campaignId: "c1",
  server: "https://sync.example.org",
  remoteId: "camp-1",
  accountId: "acc-1",
  role: "owner",
  cursor: "",
  syncedAt: null,
};
const doc = (text: string) => ({
  version: 1,
  blocks: [
    {
      id: "b",
      type: "paragraph",
      props: {},
      content: [{ type: "text", text, styles: {} }],
      children: [],
    },
  ],
});
let items = [
  {
    kind: "page",
    itemId: "p1",
    title: "Neral",
    shared: false,
    status: "private",
  },
];
let conflicts = [
  {
    kind: "page",
    itemId: "p2",
    title: "Oran",
    remoteRevision: 3,
    local: { title: "Oran", document: doc("Desktop words") },
    remote: { title: "Oran", document: doc("Laptop words") },
  },
];
beforeEach(() => {
  items = [
    {
      kind: "page",
      itemId: "p1",
      title: "Neral",
      shared: false,
      status: "private",
    },
  ];
  vi.mocked(command).mockReset();
  vi.mocked(command).mockImplementation(
    async (name: string, args?: unknown) => {
      switch (name) {
        case "sync_link":
          return link as never;
        case "sync_items":
          return items as never;
        case "sync_conflicts":
          return conflicts as never;
        case "sync_remote_items":
          return [
            {
              kind: "page",
              itemId: "r1",
              authorId: "acc-2",
              authorName: "Bob",
              revision: 2,
              payload: {
                title: "Bridge rumour",
                document: doc("<script>x</script> heard at the inn"),
              },
              updatedAt: "2026-10-26T12:00:00Z",
              mine: false,
            },
          ] as never;
        case "sync_set_share":
          items = [
            {
              ...items[0],
              shared: (args as { shared: boolean }).shared,
              status: "new",
            },
          ];
          return items as never;
        case "sync_resolve":
          conflicts = [];
          return [] as never;
        case "sync_now":
          return {
            received: 1,
            removed: 0,
            updated: 0,
            pushed: 1,
            deleted: 0,
            conflicts: 0,
            blocked: 0,
          } as never;
        default:
          throw Error(`Unexpected command: ${name}`);
      }
    },
  );
});
test("private by default, explicit sharing, attributed copies and a visible conflict choice", async () => {
  const user = userEvent.setup();
  render(<CampaignSharing campaignId="c1" busy={false} />);
  const neral = await screen.findByRole("checkbox", { name: /Neral/ });
  expect(neral).not.toBeChecked();
  expect(screen.getByText(/· private/)).toBeVisible();
  await user.click(neral);
  expect(command).toHaveBeenCalledWith("sync_set_share", {
    campaignId: "c1",
    kind: "page",
    itemId: "p1",
    shared: true,
  });
  expect(await screen.findByText(/· to send/)).toBeVisible();
  const shared = screen.getByRole("region", { name: "Shared with you" });
  expect(within(shared).getByText(/shared by Bob · revision 2/)).toBeVisible();
  // Remote text is shown as text, never interpreted as markup.
  expect(
    within(shared).getByText(/<script>x<\/script> heard at the inn/),
  ).toBeVisible();
  const conflict = screen.getByRole("region", { name: "Conflicts" });
  expect(within(conflict).getByText("Desktop words")).toBeVisible();
  expect(within(conflict).getByText("Laptop words")).toBeVisible();
  await user.click(
    within(conflict).getByRole("button", {
      name: "Keep this device's version",
    }),
  );
  expect(command).toHaveBeenCalledWith("sync_resolve", {
    campaignId: "c1",
    kind: "page",
    itemId: "p2",
    keep: "local",
  });
  await user.click(screen.getByRole("button", { name: "Synchronize now" }));
  expect(await screen.findByText(/Synchronized: 1 sent/)).toBeVisible();
  expect(screen.getByRole("button", { name: "Invite a player" })).toBeVisible();
});
test("an unlinked campaign offers create or join and contacts nothing by itself", async () => {
  vi.mocked(command).mockImplementation(async (name: string) => {
    if (name === "sync_link") return null as never;
    throw Error(`Unexpected command: ${name}`);
  });
  render(<CampaignSharing campaignId="c1" busy={false} />);
  expect(
    await screen.findByRole("button", {
      name: "Create the shared campaign on the server",
    }),
  ).toBeVisible();
  expect(command).toHaveBeenCalledTimes(1);
});
