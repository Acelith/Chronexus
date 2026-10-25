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
          <Text source={"Base Wikidot D&D 5e:"} /> {source.name}{" "}
          <Text source={" · copia personale modificabile."} />
        </p>
        <p>{wikidotBase + source.path}</p>
        <p>
          <Text
            source={
              "Testo copiato da una pagina pubblica della wiki su tua richiesta. La pagina dichiara la propria licenza; i contenuti di gioco possono appartenere ai rispettivi editori. Verifica i diritti prima di ridistribuirli."
            }
          />
        </p>
      </aside>
    );
  return (
    <aside className="catalog-license">
      <p>
        <Text source={compact ? "Base SRD 2014:" : "Base: "} /> {source.name}
        {compact ? <Text source={" · copia personale modificabile."} /> : null}
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
