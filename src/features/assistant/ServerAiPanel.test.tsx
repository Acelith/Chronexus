import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { command } from "../journal/api";
import { ServerAiSettings, ServerAsk } from "./ServerAiPanel";
import type { Profile } from "./campaignApi";
vi.mock("../journal/api", async (original) => ({
  ...(await original<typeof import("../journal/api")>()),
  command: vi.fn(),
}));
const profile: Profile = {
  settings: {
    enabled: false,
    model: "",
    digest: "",
    specialization: "multilingual-rag",
  },
  edition: "5e-2014",
  context: 8192,
  maxTokens: 512,
  includeKinds: ["page"],
  excludedIds: [],
  ruleKeys: [],
  indexedAt: null,
  manifest: [],
  execution: "local",
  serverModel: "",
};
const status = {
  server: "https://sync.example.org",
  status: {
    runtimeReachable: true,
    cloudDisabled: true,
    models: [
      { name: "qwen3.8:27b-q4_K_M", pinnedDigest: null, available: true },
      { name: "missing:1", pinnedDigest: null, available: false },
    ],
    running: 0,
    waiting: 0,
    perUserHour: 30,
    timeoutSeconds: 120,
    maxQuestionChars: 2000,
  },
};
let failNext = false;
beforeEach(() => {
  failNext = false;
  vi.mocked(command).mockReset();
  vi.mocked(command).mockImplementation(
    async (name: string, args?: unknown) => {
      const a = args as Record<string, unknown>;
      switch (name) {
        case "server_ai_status":
          return status as never;
        case "set_campaign_ai_execution":
          return {
            ...profile,
            execution: a.execution,
            serverModel: a.serverModel,
          } as never;
        case "ask_server_ai":
          if (failNext)
            throw new Error(
              "The server AI is not available right now. Try again later or switch this campaign to local AI.",
            );
          return {
            server: "https://sync.example.org",
            answer: {
              answer: "The tower is north of the river [S1].",
              verified: false,
              citations: [
                {
                  key: "S1",
                  kind: "page",
                  itemId: "p1",
                  revision: 3,
                  authorName: "Alice",
                  title: "Tower",
                },
              ],
              model: "qwen3.8:27b-q4_K_M",
              digest: "d",
              sourcesConsidered: 1,
              excludedSources: 0,
              runtimeUsed: true,
              elapsedMs: 40,
            },
          } as never;
        default:
          throw Error(`unexpected ${name}`);
      }
    },
  );
});

test("the server is contacted only on request and only available models are offered", async () => {
  const user = userEvent.setup();
  const onSaved = vi.fn();
  render(
    <ServerAiSettings
      campaignId="c1"
      profile={profile}
      disabled={false}
      onSaved={onSaved}
    />,
  );
  await user.click(screen.getByRole("radio", { name: /sharing server/ }));
  expect(command).not.toHaveBeenCalled();
  expect(
    screen.getByText(/Notes kept only on this device are not used/),
  ).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Check the server AI" }));
  expect(command).toHaveBeenCalledWith("server_ai_status", {
    campaignId: "c1",
  });
  const select = await screen.findByRole("combobox");
  expect(
    [...select.querySelectorAll("option")].map((o) => o.textContent),
  ).toEqual(["qwen3.8:27b-q4_K_M"]);
  await user.click(screen.getByRole("button", { name: "Use this choice" }));
  expect(command).toHaveBeenCalledWith("set_campaign_ai_execution", {
    campaignId: "c1",
    execution: "server",
    serverModel: "qwen3.8:27b-q4_K_M",
  });
  expect(onSaved).toHaveBeenCalledWith(
    expect.objectContaining({ execution: "server" }),
  );
});

test("an answer shows its sources and is flagged when unverified", async () => {
  const user = userEvent.setup();
  render(
    <ServerAsk
      campaignId="c1"
      model="qwen3.8:27b-q4_K_M"
      onSwitchedToLocal={() => {}}
    />,
  );
  await user.type(
    screen.getByRole("textbox", { name: "Question" }),
    "Where is the tower?",
  );
  await user.click(screen.getByRole("button", { name: "Ask the server" }));
  expect(await screen.findByText(/north of the river/)).toBeTruthy();
  expect(
    screen.getByText(/Unverified draft from https:\/\/sync.example.org/),
  ).toBeTruthy();
  expect(screen.getByText(/by Alice · revision 3/)).toBeTruthy();
});

test("a failure offers a retry and an explicit switch to local AI, never a silent one", async () => {
  const user = userEvent.setup();
  const switched = vi.fn();
  failNext = true;
  render(
    <ServerAsk
      campaignId="c1"
      model="qwen3.8:27b-q4_K_M"
      onSwitchedToLocal={switched}
    />,
  );
  await user.type(
    screen.getByRole("textbox", { name: "Question" }),
    "Where is the tower?",
  );
  await user.click(screen.getByRole("button", { name: "Ask the server" }));
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(command).not.toHaveBeenCalledWith(
    "set_campaign_ai_execution",
    expect.anything(),
  );
  await user.click(
    screen.getByRole("button", { name: "Switch this campaign to local AI" }),
  );
  expect(command).toHaveBeenCalledWith("set_campaign_ai_execution", {
    campaignId: "c1",
    execution: "local",
    serverModel: "qwen3.8:27b-q4_K_M",
  });
  expect(switched).toHaveBeenCalled();
});
