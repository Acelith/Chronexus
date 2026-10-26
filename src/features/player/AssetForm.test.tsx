import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import AssetForm from "./AssetForm";
import { emptyAsset, type Asset, type AbilityDetails } from "./api";
vi.mock("./DndCatalog", () => ({
  default: ({
    onImport,
    onClose,
  }: {
    onImport: (d: AbilityDetails) => void;
    onClose: () => void;
  }) => (
    <section aria-label="Test catalog">
      <button
        onClick={() =>
          onImport({
            ...(emptyAsset("spell", "dnd5e-2014").details as AbilityDetails),
            name: "Base SRD",
            description: "Test text",
            catalogSource: { path: "spells/test-spell", name: "Base SRD" },
          })
        }
      >
        Import test template
      </button>
      <button onClick={onClose}>Close test lookup</button>
    </section>
  ),
}));
function initial(): Asset {
  const input = emptyAsset("spell", "Sistema mio");
  if (input.details.kind !== "item") {
    input.details.name = "Mio incantesimo";
    input.details.notes = "Nota personale";
    input.details.known = true;
  }
  input.links.provenanceNotes = "Acquisito in campagna";
  return {
    id: "pc-spell",
    campaignId: "c",
    characterId: "pc",
    revision: 3,
    sourceAvailable: true,
    input,
  };
}
test("explicit template use preserves notes, flags and campaign links; draft remains unsaved and editable", async () => {
  const user = userEvent.setup();
  const onSave = vi.fn().mockResolvedValue(undefined);
  render(
    <AssetForm
      initial={initial()}
      kind="spell"
      systemId="Sistema mio"
      pages={[]}
      sessions={[]}
      busy={false}
      onSave={onSave}
      onCancel={vi.fn()}
    />,
  );
  await user.click(
    screen.getByRole("button", { name: "Search this name in D&D" }),
  );
  await screen.findByRole("button", { name: "Import test template" });
  expect(screen.getByRole("button", { name: "Save entry" })).toBeDisabled();
  await user.click(
    screen.getByRole("button", { name: "Import test template" }),
  );
  expect(onSave).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Entry name")).toHaveValue("Base SRD");
  expect(screen.getByLabelText("Entry notes")).toHaveValue("Nota personale");
  expect(screen.getByLabelText("Known")).toBeChecked();
  await user.clear(screen.getByLabelText("Entry name"));
  await user.type(screen.getByLabelText("Entry name"), "Variante mia");
  await user.click(screen.getByRole("button", { name: "Save entry" }));
  expect(onSave).toHaveBeenCalledWith(
    expect.objectContaining({
      details: expect.objectContaining({
        name: "Variante mia",
        known: true,
        notes: "Nota personale",
        catalogSource: { path: "spells/test-spell", name: "Base SRD" },
      }),
      links: expect.objectContaining({
        provenanceNotes: "Acquisito in campagna",
      }),
    }),
  );
});
test("closing lookup leaves the personal draft intact", async () => {
  const user = userEvent.setup();
  render(
    <AssetForm
      initial={initial()}
      kind="spell"
      systemId="generic"
      pages={[]}
      sessions={[]}
      busy={false}
      onSave={vi.fn()}
      onCancel={vi.fn()}
    />,
  );
  await user.click(
    screen.getByRole("button", { name: "Search this name in D&D" }),
  );
  await user.click(
    await screen.findByRole("button", { name: "Close test lookup" }),
  );
  expect(screen.getByLabelText("Entry name")).toHaveValue("Mio incantesimo");
  expect(screen.getByRole("button", { name: "Save entry" })).toBeEnabled();
});
