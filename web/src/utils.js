export const money = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
export const number = (value) =>
  new Intl.NumberFormat("en-US").format(Number(value || 0));
export const day = (value, options = {}) =>
  value
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
        ...options,
      }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`))
    : "—";
export const timestamp = (value) =>
  value
    ? new Date(
        /Z$|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`,
      ).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "Asia/Phnom_Penh",
      })
    : "—";
export const today = () => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Phnom_Penh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type) => parts.find((part) => part.type === type).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
};
