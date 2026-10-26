import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import ImageGallery, { type Attachment } from "./ImageGallery";
import { command } from "../journal/api";
vi.mock("../journal/api", async (original) => ({
  ...(await original<typeof import("../journal/api")>()),
  command: vi.fn(),
}));
const image: Attachment = {
  id: "image",
  campaignId: "a",
  caption: "Mappa della costa",
  role: "map",
  filename: "image.png",
  width: 3,
  height: 2,
  size: 72,
  sha256: "hash",
  createdAt: "2026-10-23",
};
beforeEach(() => {
  vi.mocked(command).mockReset();
});
test("file upload copies through typed commands; preview zooms and removal requires confirmation", async () => {
  const user = userEvent.setup();
  vi.mocked(command).mockImplementation(async (name) =>
    name === "list_images"
      ? []
      : name === "add_image"
        ? image
        : name === "read_image"
          ? "data:image/png;base64,AA=="
          : undefined,
  );
  render(<ImageGallery campaignId="a" target={{ kind: "page", id: "page" }} />);
  await user.click(screen.getByText("Images (0)"));
  await user.type(screen.getByLabelText("Image caption"), image.caption);
  await user.selectOptions(screen.getByLabelText("Image type"), "map");
  await user.upload(
    screen.getByLabelText("Add image"),
    new File([new Uint8Array([1, 2, 3])], "map.png", { type: "image/png" }),
  );
  await screen.findByRole("button", {
    name: "Open image: Mappa della costa",
  });
  expect(command).toHaveBeenCalledWith(
    "add_image",
    expect.objectContaining({
      campaignId: "a",
      target: { kind: "page", id: "page" },
      role: "map",
      caption: image.caption,
      dataBase64: "AQID",
    }),
  );
  await user.click(
    screen.getByRole("button", { name: "Open image: Mappa della costa" }),
  );
  await screen.findByRole("dialog");
  await user.selectOptions(screen.getByLabelText("Image zoom"), "200");
  expect(screen.getByRole("dialog").querySelector("img")).toHaveStyle({
    width: "200%",
  });
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await user.click(
    screen.getByRole("button", { name: "Remove from the entry" }),
  );
  await user.keyboard("{Escape}");
  expect(command).not.toHaveBeenCalledWith("detach_image", expect.anything());
  await user.click(
    screen.getByRole("button", { name: "Remove from the entry" }),
  );
  await user.click(screen.getByRole("button", { name: "Remove link" }));
  await waitFor(() =>
    expect(command).toHaveBeenCalledWith("detach_image", {
      campaignId: "a",
      id: "image",
    }),
  );
  expect(
    screen.queryByRole("button", { name: "Open image: Mappa della costa" }),
  ).not.toBeInTheDocument();
});
test("failed copy keeps caption and exposes failure instead of adding a fake image", async () => {
  const user = userEvent.setup();
  vi.mocked(command).mockImplementation(async (name) => {
    if (name === "list_images") return [];
    throw Error("Disk full");
  });
  render(
    <ImageGallery campaignId="a" target={{ kind: "character", id: "pc" }} />,
  );
  await user.click(screen.getByText("Images (0)"));
  await user.type(screen.getByLabelText("Image caption"), "Oran");
  await user.upload(
    screen.getByLabelText("Add image"),
    new File(["test"], "oran.jpg", { type: "image/jpeg" }),
  );
  await screen.findByRole("alert");
  expect(screen.getByRole("alert")).toHaveTextContent("Disk full");
  expect(screen.getByLabelText("Image caption")).toHaveValue("Oran");
  expect(
    screen.queryByRole("button", { name: /Open image/ }),
  ).not.toBeInTheDocument();
});
