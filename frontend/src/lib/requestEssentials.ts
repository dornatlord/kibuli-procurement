/**
 * What a procurement request must have before it is saved: everything TFORM 5
 * prints that only the person raising it can supply. The server checks the
 * same (backend/src/lib/requestEssentials.ts), with the same labels, so the
 * form can point at each box that still needs filling in.
 */

export interface EssentialItem {
  description: string;
  quantity: string;
  unitOfMeasure: string;
  estimatedUnitCost: string;
}

export interface EssentialsForm {
  weekNumber: string;
  term: string;
  subject: string;
  location: string;
  dateRequired: string;
  /** Part III: the vote, and whether the chosen vote has sub-programmes to pick from. */
  voteId: number | "";
  hasSubProgrammes: boolean;
  subProgrammeId: number | "";
  /** The budget line chosen: a budget item, or a sub-programme with no items of its own. */
  lineChosen: boolean;
  items: EssentialItem[];
}

const blank = (v: string | null | undefined) => !v || !String(v).trim();
const positive = (v: string) => !blank(v) && Number.isFinite(Number(v)) && Number(v) > 0;

export const LABELS = {
  week: "Week",
  term: "Term",
  subject: "Subject of procurement",
  location: "Location for delivery",
  date: "Date required",
  vote: "Programme (vote)",
  sub: "Sub-programme",
  line: "Budget item",
  items: "At least one item",
} as const;

/** A started row: blank starter rows don't count as items. */
export const startedItem = (it: EssentialItem) => !blank(it.description) || positive(it.quantity) || positive(it.estimatedUnitCost);

/** The gaps in one item row, by name ("unit", "unit cost"). */
export function itemGaps(it: EssentialItem): string[] {
  return [
    blank(it.description) && "description",
    !positive(it.quantity) && "quantity",
    blank(it.unitOfMeasure) && "unit",
    !positive(it.estimatedUnitCost) && "unit cost",
  ].filter((g): g is string => !!g);
}

/** Everything still to fill in, by its label on the form. */
export function missingFromForm(f: EssentialsForm): string[] {
  const missing: string[] = [];
  if (blank(f.weekNumber)) missing.push(LABELS.week);
  if (blank(f.term)) missing.push(LABELS.term);
  if (blank(f.subject)) missing.push(LABELS.subject);
  if (blank(f.location)) missing.push(LABELS.location);
  if (blank(f.dateRequired)) missing.push(LABELS.date);
  if (!f.voteId) missing.push(LABELS.vote);
  else if (f.hasSubProgrammes && !f.subProgrammeId) missing.push(LABELS.sub);
  else if (!f.lineChosen) missing.push(LABELS.line);
  const started = f.items.filter(startedItem);
  if (started.length === 0) missing.push(LABELS.items);
  started.forEach((it, i) => {
    const gaps = itemGaps(it);
    if (gaps.length) missing.push(`Item ${i + 1}: ${gaps.join(", ")}`);
  });
  return missing;
}
