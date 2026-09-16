/** A school term: the whole months it covers, which FORM 27 reports as its quarter. */
export interface SchoolTerm {
  term: number;
  startMonth: number;
  endMonth: number;
}

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "January – April" */
export function termMonths(t: SchoolTerm) {
  const from = MONTHS[t.startMonth - 1];
  return t.startMonth === t.endMonth ? from : `${from} – ${MONTHS[t.endMonth - 1]}`;
}

/** The term a month falls in, if any. */
export function termFor(terms: SchoolTerm[], month: number) {
  return terms.find((t) => month >= t.startMonth && month <= t.endMonth) ?? null;
}
