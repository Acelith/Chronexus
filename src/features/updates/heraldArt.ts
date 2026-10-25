/**
 * Raster illustrations for the herald (see assets/herald/README.md). Set an
 * entry to null to fall back to the geometric trumpet emblem.
 */
export const heraldArt: { herald: string | null; manifesto: string | null } = {
  herald: new URL("../../../assets/herald/herald.webp", import.meta.url).href,
  manifesto: new URL("../../../assets/herald/manifesto.webp", import.meta.url)
    .href,
};
