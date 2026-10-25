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
    return `${policy.primary.label} · ${tr("Primary")}`;
  if (name === SECONDARY_MODEL)
    return `${policy.secondary.label} · ${tr("Secondary")}`;
  return name;
}
export const retiredNotice =
  "The previous Qwen model has been retired. Choose and activate a qualified model; history and citations are kept.";
export const modelGuidance =
  "Qwen3.8-27B is the primary choice, running on GPU and RAM together. Gemma 4 12B is the faster secondary option. No model is activated or downloaded automatically.";
