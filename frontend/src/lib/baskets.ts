/** Shapes returned by /api/baskets, shared by the request form and the Baskets pages. */

export interface BasketSummary {
  id: number;
  name: string;
  description: string | null;
  budgetItemId: number | null;
  subProgrammeId: number | null;
  budgetItemName: string | null;
  subProgrammeName: string | null;
  voteCode: string | null;
  itemCount: number;
  /** Saved quantities × today's prices, as a numeric string. */
  estimatedValue: string;
  createdByName: string | null;
  updatedAt: string | null;
  canEdit: boolean;
}

export interface BasketItem {
  id: number;
  itemNo: number;
  reservePriceItemId: number | null;
  /** True while the linked price-list entry is active: name, unit and price are current. */
  fromPriceList: boolean;
  description: string;
  unitOfMeasure: string | null;
  unitCost: string | null;
  maximumPrice: string | null;
  defaultQuantity: string | null;
}

export interface BasketDetail {
  id: number;
  name: string;
  description: string | null;
  budgetItemId: number | null;
  subProgrammeId: number | null;
  canEdit: boolean;
  items: BasketItem[];
}

/** One budget line from /api/lookup/budget-lines. */
export interface BudgetLine {
  /** "bi:108" for a budget item, "sp:26" for a Tuition Stores department. */
  key: string;
  kind: "bi" | "sp";
  id: number;
  name: string;
  voteCode: string;
  voteName: string;
  subProgrammeName: string | null;
  priceCategories: string[];
  supplyCode: string | null;
}

export function basketLineKey(b: { budgetItemId: number | null; subProgrammeId: number | null }) {
  if (b.budgetItemId) return `bi:${b.budgetItemId}`;
  if (b.subProgrammeId) return `sp:${b.subProgrammeId}`;
  return null;
}

/** "2204 · Food expenses": the budget line a basket is offered for. */
export function basketLineLabel(b: BasketSummary) {
  const name = b.budgetItemName ?? b.subProgrammeName;
  if (!name) return null;
  return b.voteCode ? `${b.voteCode} · ${name}` : name;
}

/** Split a line key back into the ids the API stores. */
export function lineIds(key: string | null) {
  const [kind, id] = (key ?? "").split(":");
  return {
    budgetItemId: kind === "bi" ? Number(id) : null,
    subProgrammeId: kind === "sp" ? Number(id) : null,
  };
}

export const money = (v: string | number | null | undefined) =>
  v === null || v === undefined || v === "" ? "—" : Number(v).toLocaleString("en-UG");
