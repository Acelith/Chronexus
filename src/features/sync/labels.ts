import { tr } from "../../i18n/store";

/** Localize the display label, preserving the server's canonical role value. */
export function roleText(role: string) {
  switch (role) {
    case "owner":
      return tr("Campaign owner");
    case "player":
      return tr("Player");
    case "reader":
      return tr("Read-only member");
    default:
      return role;
  }
}
