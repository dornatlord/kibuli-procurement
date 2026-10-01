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

/**
 * The term and the week of the term a day falls in, as FORM 5 prints them:
 * "Week 5, Term 3". The term is the one whose months hold the day; in a
 * holiday month, the term that has just ended. Week 1 is the school week
 * (Monday to Sunday) holding the 1st of the term's first month. The server
 * works these out the same way for requests saved without them.
 */
export function termAndWeek(terms: SchoolTerm[], day: Date): { term: number; week: number } | null {
  if (terms.length === 0) return null;
  const year = day.getFullYear();
  const month = day.getMonth() + 1;
  const t =
    termFor(terms, month) ?? [...terms].reverse().find((x) => x.startMonth <= month) ?? terms[0];
  const start = Date.UTC(year, t.startMonth - 1, 1);
  const days = Math.round((Date.UTC(year, month - 1, day.getDate()) - start) / 86400000);
  const mondayOffset = (new Date(start).getUTCDay() + 6) % 7;
  return { term: t.term, week: days < 0 ? 1 : Math.floor((days + mondayOffset) / 7) + 1 };
}
