const dateFormat = new Intl.DateTimeFormat("it-CH", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});
export const rollDate = (value: string) => dateFormat.format(new Date(value));
