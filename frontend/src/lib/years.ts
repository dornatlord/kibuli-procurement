/** A date's calendar year in Kampala: the school's year for numbering, budgets and reports. */
export const kampalaYear = (d: Date) =>
  Number(new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kampala", year: "numeric" }).format(d));

export const thisYear = () => kampalaYear(new Date());

/** The year of a "YYYY-MM-DD" date as written, or of a timestamp in Kampala. */
export function yearOf(value: string | null | undefined): number | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return Number(value.slice(0, 4));
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : kampalaYear(d);
}

/** The years to offer: those given, and this year, newest first, each once. */
export function yearChoices(years: Iterable<number | null | undefined>, ...extra: number[]): number[] {
  const all = new Set<number>([thisYear(), ...extra]);
  for (const y of years) if (y) all.add(y);
  return [...all].sort((a, b) => b - a);
}
