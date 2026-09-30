import { useMemo, useState } from "react";
import { thisYear, yearChoices } from "./years";

/**
 * One year of a list at a time: this year to begin with, or every year at once.
 * `yearOf` says which year a row belongs to.
 */
export function useYearFilter<T>(rows: T[], yearOf: (row: T) => number | null) {
  const [year, setYear] = useState<number | "all">(thisYear());
  const years = useMemo(() => yearChoices(rows.map(yearOf)), [rows]);
  const shown = year === "all" ? rows : rows.filter((r) => yearOf(r) === year);
  return { year, setYear, years, shown };
}
