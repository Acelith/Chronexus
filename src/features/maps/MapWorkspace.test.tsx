import { applyPreferences, loadLocale, tr } from "../../i18n/store";
import { defaultPreferences } from "../../i18n/locales";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import MapWorkspace from "./MapWorkspace";
import { mapsApi, type Pin } from "./api";
import type { KnowledgePage } from "../knowledge/api";

vi.mock("./api", () => ({
  mapsApi: {
    images: vi.fn(),
    pins: vi.fn(),
    routes: vi.fn(),
    image: vi.fn(),
    savePin: vi.fn(),
    deletePin: vi.fn(),
    addRoute: vi.fn(),
    deleteRoute: vi.fn(),
    relink: vi.fn(),
  },
}));
vi.mock("../clues/api", () => ({
  clueApi: { list: vi.fn().mockResolvedValue([]) },
}));
const page: KnowledgePage = {
  id: "page",
  campaignId: "campaign",
  title: "Harbor",
  kind: "place",
  status: "active",
  aliases: [],
  document: { version: 1, blocks: [] },
  revision: 0,
  updatedAt: "",
};
const pin: Pin = {
  id: "pin",
  campaignId: "campaign",
  imageId: "image",
  input: {
    sourceKind: "page",
    sourceId: "page",
    label: "Port",
    x: 500000,
    y: 500000,
  },
  revision: 0,
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(mapsApi.images).mockResolvedValue([
    {
      id: "image",
      caption: "Harbor map",
      width: 1000,
      height: 800,
      pageId: "page",
    },
  ]);
  vi.mocked(mapsApi.pins).mockResolvedValue([pin]);
  vi.mocked(mapsApi.routes).mockResolvedValue([]);
  vi.mocked(mapsApi.image).mockResolvedValue("data:image/png;base64,AA==");
});
afterEach(() => applyPreferences(defaultPreferences));
it.each(["en", "it", "ar"] as const)(
  "%s: moves a pin through keyboard-editable relative coordinates",
  async (locale) => {
    await loadLocale(locale);
    applyPreferences({ ...defaultPreferences, locale });
    vi.mocked(mapsApi.savePin).mockResolvedValue({
      ...pin,
      input: { ...pin.input, x: 425000 },
      revision: 1,
    });
    render(
      <MapWorkspace
        campaignId="campaign"
        sessions={[]}
        pages={[page]}
        onSession={vi.fn()}
        onPage={vi.fn()}
        onClue={vi.fn()}
      />,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: tr("Edit pin") }),
    );
    fireEvent.change(screen.getByLabelText(tr("Horizontal position (%)")), {
      target: { value: "42.5" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: tr("Save pin position") }),
    );
    await waitFor(() =>
      expect(mapsApi.savePin).toHaveBeenCalledWith(
        "campaign",
        "image",
        { ...pin.input, x: 425000 },
        pin,
      ),
    );
  },
);

it("clears the old map draft and disables writes while another image loads", async () => {
  vi.mocked(mapsApi.images).mockResolvedValue([
    {
      id: "image",
      caption: "First map",
      width: 1000,
      height: 800,
      pageId: "page",
    },
    {
      id: "second",
      caption: "Second map",
      width: 1000,
      height: 800,
      pageId: "page",
    },
  ]);
  let finish: (url: string) => void = () => {};
  vi.mocked(mapsApi.image).mockImplementation(async (_, id) =>
    id === "second"
      ? new Promise<string>((resolve) => {
          finish = resolve;
        })
      : "data:image/png;base64,AA==",
  );
  render(
    <MapWorkspace
      campaignId="campaign"
      sessions={[]}
      pages={[page]}
      onSession={vi.fn()}
      onPage={vi.fn()}
      onClue={vi.fn()}
    />,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Edit pin" }));
  fireEvent.change(screen.getByLabelText("Map image"), {
    target: { value: "second" },
  });
  expect(screen.getByLabelText("Pin label")).toHaveValue("");
  expect(screen.getByRole("button", { name: "Add pin" })).toBeDisabled();
  expect(
    screen.queryByRole("button", { name: "Save pin position" }),
  ).not.toBeInTheDocument();
  finish("data:image/png;base64,AA==");
  await waitFor(() =>
    expect(screen.getByLabelText("Pin label")).not.toBeDisabled(),
  );
  expect(mapsApi.savePin).not.toHaveBeenCalled();
});
