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
  await user.click(screen.getByText("Immagini (0)"));
  await user.type(screen.getByLabelText("Didascalia immagine"), image.caption);
  await user.selectOptions(screen.getByLabelText("Tipo immagine"), "map");
  await user.upload(
    screen.getByLabelText("Aggiungi immagine"),
    new File([new Uint8Array([1, 2, 3])], "map.png", { type: "image/png" }),
  );
  await screen.findByRole("button", {
    name: "Apri immagine: Mappa della costa",
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
    screen.getByRole("button", { name: "Apri immagine: Mappa della costa" }),
  );
  await screen.findByRole("dialog");
  await user.selectOptions(
    screen.getByLabelText("Ingrandimento immagine"),
    "200",
  );
  expect(screen.getByRole("dialog").querySelector("img")).toHaveStyle({
    width: "200%",
  });
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Rimuovi dalla voce" }));
  await user.keyboard("{Escape}");
  expect(command).not.toHaveBeenCalledWith("detach_image", expect.anything());
  await user.click(screen.getByRole("button", { name: "Rimuovi dalla voce" }));
  await user.click(
    screen.getByRole("button", { name: "Rimuovi collegamento" }),
  );
  await waitFor(() =>
    expect(command).toHaveBeenCalledWith("detach_image", {
      campaignId: "a",
      id: "image",
    }),
  );
  expect(
    screen.queryByRole("button", { name: "Apri immagine: Mappa della costa" }),
  ).not.toBeInTheDocument();
});
test("failed copy keeps caption and exposes failure instead of adding a fake image", async () => {
  const user = userEvent.setup();
  vi.mocked(command).mockImplementation(async (name) => {
    if (name === "list_images") return [];
    throw Error("Disco pieno");
  });
  render(
    <ImageGallery campaignId="a" target={{ kind: "character", id: "pc" }} />,
  );
  await user.click(screen.getByText("Immagini (0)"));
  await user.type(screen.getByLabelText("Didascalia immagine"), "Oran");
  await user.upload(
    screen.getByLabelText("Aggiungi immagine"),
    new File(["test"], "oran.jpg", { type: "image/jpeg" }),
  );
  await screen.findByRole("alert");
  expect(screen.getByRole("alert")).toHaveTextContent("Disco pieno");
  expect(screen.getByLabelText("Didascalia immagine")).toHaveValue("Oran");
  expect(
    screen.queryByRole("button", { name: /Apri immagine/ }),
  ).not.toBeInTheDocument();
});
