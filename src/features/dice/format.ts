import { date } from "../../i18n/store";
export const rollDate = (value: string) =>
  date(value, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
