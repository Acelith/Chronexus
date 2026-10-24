import { useSyncExternalStore } from "react";
const query = "(prefers-reduced-motion: reduce)";
function snapshot() {
  return (
    typeof window.matchMedia === "function" && window.matchMedia(query).matches
  );
}
function subscribe(change: () => void) {
  if (typeof window.matchMedia !== "function") return () => {};
  const media = window.matchMedia(query);
  media.addEventListener("change", change);
  return () => media.removeEventListener("change", change);
}
export function useReducedMotion() {
  return useSyncExternalStore(subscribe, snapshot, () => true);
}
