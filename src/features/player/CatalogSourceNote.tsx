import { Text } from "../../i18n/Text";
import type { AbilityDetails } from "./api";
import { catalogBase, srdAttribution } from "./catalog";
import { wikidotBase } from "../wiki/wikidot";

/** Provenance of a spell copied from a catalog; the copy itself is personal. */
export default function CatalogSourceNote({
  source,
  compact = false,
}: {
  source: NonNullable<AbilityDetails["catalogSource"]>;
  compact?: boolean;
}) {
  if (source.provider === "wikidot")
    return (
      <aside className="catalog-license">
        <p>
          <Text source={"Wikidot D&D 5e base:"} /> {source.name}{" "}
          <Text source={" · editable personal copy."} />
        </p>
        <p>{wikidotBase + source.path}</p>
        <p>
          <Text
            source={
              "Text copied from a public wiki page at your request. The page states its own license; game content may belong to its publishers. Check the rights before redistributing it."
            }
          />
        </p>
      </aside>
    );
  return (
    <aside className="catalog-license">
      <p>
        <Text source={compact ? "SRD 2014 base:" : "Base: "} /> {source.name}
        {compact ? <Text source={" · editable personal copy."} /> : null}
      </p>
      <p>{catalogBase + source.path}</p>
      <p>{srdAttribution}</p>
      {compact ? null : (
        <p>
          <Text
            source={
              "SRD 5.1: https://dnd.wizards.com/resources/systems-reference-document · CC BY 4.0: https://creativecommons.org/licenses/by/4.0/"
            }
          />
        </p>
      )}
    </aside>
  );
}
