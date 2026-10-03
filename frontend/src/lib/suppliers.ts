import { useEffect, useState } from "react";
import { api } from "./api";
import type { ComboOption } from "../components/Combobox";

/** A supplier's place on the pre-qualified list: the category, and the headings it's listed under there. */
export interface SupplierCategoryRef {
  number: number;
  name: string;
  groups: string[];
}

/** A supplier as the boxes that suggest suppliers need it. */
export interface SupplierName {
  id: number;
  name: string;
  /** On this year's list of suppliers, rather than only an earlier year's. */
  onThisYearsList: boolean;
  /** Its categories on the pre-qualified list in force. */
  categories?: SupplierCategoryRef[];
}

/** A heading short enough for a hint: "Beans (Nambale short, …)" → "Beans"; "(A) Generator" stays. */
export const shortHeading = (heading: string) => (heading.startsWith("(") ? heading : heading.split(" (")[0]);

/** "2 · Food: Maize flour, Beans" for one category; several are joined with "; ". */
export function categoryHint(categories: SupplierCategoryRef[] | undefined): string | undefined {
  if (!categories?.length) return undefined;
  return categories
    .map((c) => `${c.number} · ${c.name}${c.groups.length ? `: ${c.groups.map(shortHeading).join(", ")}` : ""}`)
    .join("; ");
}

/**
 * Loads once `enabled` (and again when `path` changes); null until then, or if
 * it can't load, so the boxes that use it still take whatever is typed.
 */
function useLoaded<T>(path: string | null, enabled: boolean): T | null {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    if (!enabled || !path) return;
    let live = true;
    api
      .get<T>(path)
      .then((rows) => live && setData(rows))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [path, enabled]);
  return data;
}

/**
 * Every active supplier's name, this year's list first, with its categories on
 * the pre-qualified list, for the boxes where a supplier is typed (Part II's
 * shortlisted providers, a call-off order's provider).
 */
export function useSupplierNames(enabled = true): SupplierName[] {
  return useLoaded<SupplierName[]>("/suppliers/names", enabled) ?? [];
}

/** The suppliers as choices for a box: each one's categories beside it, those only on an earlier year's list marked. */
export function supplierChoices(names: SupplierName[]): ComboOption[] {
  return names.map((s) => ({
    value: s.name,
    hint: [s.onThisYearsList ? null : "Not on this year's list", categoryHint(s.categories)].filter(Boolean).join(" · ") || undefined,
  }));
}

// ── The pre-qualified list ─────────────────────────────────────────────────

export interface PrequalifiedMember {
  supplierId: number;
  name: string;
  /** Sent only to those who may see the supplier register. */
  phone: string | null;
  address: string | null;
  position: number;
  /** The category's headings it's listed under, 1 being the first. */
  groups: number[];
  /** The list's own spelling, where the register's differs. */
  printedName: string | null;
  isActive: boolean;
}

export type ListSection = "supplies" | "non_consultancy" | "works";

export interface PrequalifiedCategory {
  id: number;
  /** Numbered straight through Supplies, Services and Works. */
  number: number;
  section: ListSection;
  reference: string | null;
  name: string;
  /** The headings listed under the one reference ("Maize flour", "Beans" …). */
  groups: string[];
  members: PrequalifiedMember[];
  /** The budget lines ("bi:108", "sp:32") that draw on it, each perhaps narrowed to some headings. */
  lines: { key: string; groups: number[] }[];
}

export interface PrequalifiedList {
  /** The list's year: the one asked for, or the latest earlier one when that has none. Null when there's no list. */
  year: number | null;
  /** The years that have a list, latest first. */
  years: number[];
  categories: PrequalifiedCategory[];
}

/** The pre-qualified list in force in `year` (this year's when left out). */
export function usePrequalifiedList(year?: number | null, enabled = true): PrequalifiedList | null {
  return useLoaded<PrequalifiedList>(`/suppliers/prequalified${year ? `?year=${year}` : ""}`, enabled);
}

/** A supplier pre-qualified for a budget line, and why: its categories and headings there. */
export interface LineSupplier {
  supplierId: number;
  name: string;
  hint: string;
}

/**
 * The suppliers pre-qualified for a budget line (a request form's line key,
 * "bi:108" for Food expenses): everyone on the categories the line draws on,
 * narrowed to the headings it takes, in category and list order, each once.
 */
export function lineSuppliers(list: PrequalifiedList | null, lineKey: string | null | undefined): LineSupplier[] {
  if (!list || !lineKey) return [];
  const found = new Map<number, LineSupplier>();
  for (const c of list.categories) {
    const link = c.lines.find((l) => l.key === lineKey);
    if (!link) continue;
    for (const m of c.members) {
      const headings = link.groups.length ? m.groups.filter((g) => link.groups.includes(g)) : m.groups;
      if (!m.isActive || (link.groups.length && !headings.length)) continue;
      const named = headings.map((g) => c.groups[g - 1]).filter(Boolean).map(shortHeading);
      const why = `${c.number} · ${c.name}${named.length ? `: ${named.join(", ")}` : ""}`;
      const seen = found.get(m.supplierId);
      if (seen) seen.hint += `; ${why}`;
      else found.set(m.supplierId, { supplierId: m.supplierId, name: m.name, hint: why });
    }
  }
  return [...found.values()];
}

/** The categories a budget line draws on: "2 · Food", "22 · Plant maintenance: (A) Generator". */
export function lineCategories(list: PrequalifiedList | null, lineKey: string | null | undefined): string[] {
  if (!list || !lineKey) return [];
  return list.categories.flatMap((c) => {
    const link = c.lines.find((l) => l.key === lineKey);
    if (!link) return [];
    const named = link.groups.map((g) => c.groups[g - 1]).filter(Boolean);
    return [`${c.number} · ${c.name}${named.length ? `: ${named.join(", ")}` : ""}`];
  });
}

/**
 * The choices for a box where a provider is typed. While the box is empty, or
 * holds one of them, it offers just the suppliers pre-qualified for the
 * request's budget line, when the line has any; once something else is typed,
 * every supplier, the line's first. `first` goes ahead of all of them (such as
 * the provider already chosen elsewhere on the request), and names in
 * `leaveOut` (taken by the boxes beside this one) aren't offered again.
 */
export function providerChoices({
  value,
  line,
  names,
  first = [],
  leaveOut = [],
}: {
  value: string;
  line: LineSupplier[];
  names: SupplierName[];
  first?: ComboOption[];
  leaveOut?: string[];
}): ComboOption[] {
  const lower = (s: string) => s.trim().toLowerCase();
  const typed = lower(value);
  const taken = new Set(leaveOut.map(lower).filter((n) => n && n !== typed));
  const fromLine = line.map((s) => ({ value: s.name, hint: `Pre-qualified: ${s.hint}` }));
  const narrow = line.length > 0 && (!typed || [...first, ...fromLine].some((o) => lower(o.value) === typed));
  const others = narrow ? [] : supplierChoices(names);
  return [...first, ...fromLine, ...others].filter((o) => !taken.has(lower(o.value)));
}

// ── A request's provider ───────────────────────────────────────────────────

export interface RequestProviders {
  request: {
    id: number;
    referenceNumber: string;
    subjectOfProcurement: string | null;
    year: number;
    procurementSize: string;
    budgetItemId: number | null;
    subProgrammeId: number | null;
  };
  /** The request's budget line: its form key ("bi:108") and how the form names it ("2204-1 Food expenses"). */
  line: { key: string; label: string } | null;
  /** Part II's shortlisted providers, each with its register id where it's spelt as in the register. */
  shortlisted: { name: string; supplierId: number | null }[];
  lpoSupplier: { supplierId: number; name: string } | null;
  /** The supplier on the request's LPO, or before there is one, the first provider shortlisted in Part II. */
  provider: { name: string; supplierId: number | null; from: "lpo" | "part2" } | null;
}

/** Who the provider is on a request, for the places that ask for one again (a new LPO, a contract). */
export function useRequestProviders(requestId: string | number | null | undefined): RequestProviders | null {
  return useLoaded<RequestProviders>(requestId ? `/suppliers/for-request/${requestId}` : null, true);
}

/** Where a request's provider was filled in from, for a note under the box. */
export const providerSource = (p: RequestProviders["provider"]) =>
  p?.from === "lpo" ? "the supplier on this request's LPO" : "the provider shortlisted in Part II";
