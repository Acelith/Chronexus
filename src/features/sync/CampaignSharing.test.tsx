import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { command } from "../journal/api";
import CampaignSharing from "./CampaignSharing";
import SyncStatusBadge from "./SyncStatusBadge";
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
  auto: false,
  paused: false,
  lastError: null,
};
const status = (state: string, extra: object = {}) => ({
  campaignId: "c1",
  state,
  pending: 0,
  conflicts: 0,
  blocked: 0,
  lastSyncedAt: null,
  message: null,
  retryInSeconds: null,
  ...extra,
});
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
const neral = (scope: string, state: string) => ({
  kind: "page",
  itemId: "p1",
  title: "Neral",
  shared: scope === "shared",
  scope,
  status: state,
});
let items = [neral("none", "private")];
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
let current = { ...link };
beforeEach(() => {
  items = [neral("none", "private")];
  current = { ...link };
  vi.mocked(command).mockReset();
  vi.mocked(command).mockImplementation(
    async (name: string, args?: unknown) => {
      switch (name) {
        case "sync_link":
          return current as never;
        case "sync_items":
          return items as never;
        case "sync_conflicts":
          return conflicts as never;
        case "sync_status":
          return status(current.auto ? "saved" : "off") as never;
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
        case "sync_set_scope":
          items = [neral((args as { scope: string }).scope, "new")];
          return items as never;
        case "sync_replicate_all":
          items = [neral("private", "new")];
          return items as never;
        case "sync_set_auto": {
          const input = args as { enabled: boolean; paused: boolean };
          current = { ...current, auto: input.enabled, paused: input.paused };
          return current as never;
        }
        case "sync_resolve":
          conflicts = [];
          return [] as never;
        case "sync_now":
          return {
            received: 1,
            removed: 0,
            updated: 0,
            materialized: 0,
            pushed: 1,
            deleted: 0,
            conflicts: 0,
            blocked: 0,
            resynchronized: false,
          } as never;
        default:
          throw Error(`Unexpected command: ${name}`);
      }
    },
  );
});
test("nothing leaves by default, each item has an explicit scope, copies stay attributed and a conflict shows both versions", async () => {
  const user = userEvent.setup();
  render(<CampaignSharing campaignId="c1" busy={false} />);
  const scope = await screen.findByRole("combobox", { name: /Neral/ });
  expect(scope).toHaveValue("none");
  expect(
    screen.getByText(
      /Summary: 1 only on this device · 0 private copies on the server · 0 shared/,
    ),
  ).toBeVisible();
  expect(screen.getByText(/· only on this device/)).toBeVisible();
  await user.selectOptions(scope, "private");
  expect(command).toHaveBeenCalledWith("sync_set_scope", {
    campaignId: "c1",
    kind: "page",
    itemId: "p1",
    scope: "private",
  });
  expect(await screen.findByText(/· to send/)).toBeVisible();
  expect(
    screen.getByText(/Summary: 0 only on this device · 1 private copies/),
  ).toBeVisible();
  expect(screen.getByRole("combobox", { name: /Neral/ })).toHaveValue(
    "private",
  );
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
test("automatic synchronization is an explicit opt-in that can be paused, and says what it will do", async () => {
  const user = userEvent.setup();
  render(<CampaignSharing campaignId="c1" busy={false} />);
  const toggle = await screen.findByRole("checkbox", {
    name: /Keep this campaign synchronized automatically/,
  });
  expect(toggle).not.toBeChecked();
  expect(
    screen.queryByRole("button", { name: /Pause automatic synchronization/ }),
  ).toBeNull();
  await user.click(toggle);
  expect(command).toHaveBeenCalledWith("sync_set_auto", {
    campaignId: "c1",
    enabled: true,
    paused: false,
  });
  expect(
    await screen.findByText(/Chronexus will contact the server/),
  ).toBeVisible();
  await user.click(
    await screen.findByRole("button", {
      name: "Pause automatic synchronization",
    }),
  );
  expect(command).toHaveBeenCalledWith("sync_set_auto", {
    campaignId: "c1",
    enabled: true,
    paused: true,
  });
  expect(
    await screen.findByRole("button", {
      name: "Resume automatic synchronization",
    }),
  ).toBeVisible();
});
test("copying everything privately is confirmed first and explains what is and is not included", async () => {
  const user = userEvent.setup();
  render(<CampaignSharing campaignId="c1" busy={false} />);
  await user.click(
    await screen.findByRole("button", {
      name: "Keep a private copy of everything",
    }),
  );
  const dialog = screen.getByRole("alertdialog");
  expect(within(dialog).getByText(/They stay private/)).toBeVisible();
  expect(within(dialog).getByText(/Character sheets, images/)).toBeVisible();
  expect(command).not.toHaveBeenCalledWith("sync_replicate_all", {
    campaignId: "c1",
  });
  await user.click(
    within(dialog).getByRole("button", { name: "Copy everything privately" }),
  );
  expect(command).toHaveBeenCalledWith("sync_replicate_all", {
    campaignId: "c1",
  });
  expect(await screen.findByRole("combobox", { name: /Neral/ })).toHaveValue(
    "private",
  );
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
test("the save state never calls a local save a server save", async () => {
  const cases: [object, RegExp][] = [
    [status("saved"), /Saved on this device and on the server/],
    [
      status("pending", { pending: 2 }),
      /Saved on this device · waiting to be sent \(2\)/,
    ],
    [
      status("offline", { pending: 1, retryInSeconds: 30 }),
      /Saved on this device · server not reachable, trying again in 30 s/,
    ],
    [status("conflict", { conflicts: 2 }), /2 conflicts need your decision/],
    [
      status("attention", { message: "Session expired" }),
      /Synchronization stopped: Session expired/,
    ],
    [
      status("paused", { pending: 3 }),
      /Paused · 3 changes stay on this device/,
    ],
  ];
  for (const [value, text] of cases) {
    vi.mocked(command).mockReset();
    vi.mocked(command).mockResolvedValue(value as never);
    const { unmount } = render(
      <SyncStatusBadge campaignId="c1" onOpen={() => {}} />,
    );
    expect(await screen.findByText(text)).toBeVisible();
    unmount();
  }
  // A campaign that does not synchronize shows nothing at all.
  vi.mocked(command).mockReset();
  vi.mocked(command).mockResolvedValue(status("off") as never);
  const { container } = render(
    <SyncStatusBadge campaignId="c1" onOpen={() => {}} />,
  );
  await vi.waitFor(() => expect(command).toHaveBeenCalled());
  expect(container).toBeEmptyDOMElement();
});
