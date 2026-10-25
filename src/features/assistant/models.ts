import policy from "../../ai-models.json";
import { tr } from "../../i18n/store";
import type { Model } from "./api";
export const PRIMARY_MODEL = policy.primary.name;
export const SECONDARY_MODEL = policy.secondary.name;
export const retiredQwen = (name: string) =>
  /^qwen/i.test(name) && name !== PRIMARY_MODEL;
export function usableModels(models: Model[]) {
  return models
    .filter(
      (m) =>
        !m.dndSpecialized &&
        !!m.weightDigest &&
        ((m.name === PRIMARY_MODEL &&
          m.weightDigest === policy.primary.weightDigest) ||
          (m.name === SECONDARY_MODEL &&
            m.weightDigest === policy.secondary.weightDigest) ||
          m.name.startsWith("chronexus-12b-")),
    )
    .sort(
      (a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name),
    );
}
const rank = (name: string) =>
  name === PRIMARY_MODEL ? 0 : name === SECONDARY_MODEL ? 1 : 2;
export function preferredModel(models: Model[], previous = "") {
  const available = usableModels(models);
  return available.some((m) => m.name === previous)
    ? previous
    : (available[0]?.name ?? "");
}
export function modelLabel(name: string) {
  if (name === PRIMARY_MODEL)
    return `${policy.primary.label} · ${tr("Principale")}`;
  if (name === SECONDARY_MODEL)
    return `${policy.secondary.label} · ${tr("Secondario")}`;
  return name;
}
export const retiredNotice =
  "Il precedente modello Qwen è stato ritirato. Scegli e attiva un modello qualificato; cronologia e citazioni sono conservate.";
export const modelGuidance =
  "Qwen3.8-27B è la scelta principale, con esecuzione mista GPU/RAM. Gemma 4 12B è l’opzione secondaria più rapida. Nessun modello viene attivato o scaricato automaticamente.";
