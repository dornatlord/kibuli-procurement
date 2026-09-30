/** The calendar year in Kampala: the school's year for numbering, budgets and reports. */
export const thisYear = () =>
  Number(new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kampala", year: "numeric" }).format(new Date()));

/** A year sent in a query or body, or null when it isn't a sensible one. */
export function yearFrom(value: unknown): number | null {
  const y = Number(value);
  return Number.isInteger(y) && y >= 2000 && y <= 2100 ? y : null;
}
