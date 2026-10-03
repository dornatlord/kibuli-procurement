import { and, asc, desc, eq, inArray, lte } from "drizzle-orm";
import { db } from "../db/index.js";
import { supplierCategories, supplierCategoryLines, supplierCategoryMembers, suppliers } from "../db/schema.js";

/**
 * The year of the pre-qualified list in force in `year`: that year's own, or
 * else the latest earlier one, since a list stays in use until the Contracts
 * Committee approves the next. Null when there's none at all.
 */
export async function listYearFor(year: number): Promise<number | null> {
  const [row] = await db
    .select({ year: supplierCategories.year })
    .from(supplierCategories)
    .where(lte(supplierCategories.year, year))
    .orderBy(desc(supplierCategories.year))
    .limit(1);
  return row?.year ?? null;
}

/** The years that have a list, latest first. */
export async function listYears(): Promise<number[]> {
  const rows = await db
    .selectDistinct({ year: supplierCategories.year })
    .from(supplierCategories)
    .orderBy(desc(supplierCategories.year));
  return rows.map((r) => r.year);
}

/**
 * A year's list as the pages show it: the categories in number order, each
 * with its suppliers in the list's order and the budget lines that draw on it
 * (keyed "bi:<budget item id>" or "sp:<sub-programme id>", like the request
 * form's lines).
 */
export async function prequalifiedList(year: number) {
  const categories = await db
    .select()
    .from(supplierCategories)
    .where(eq(supplierCategories.year, year))
    .orderBy(asc(supplierCategories.number));
  const ids = categories.map((c) => c.id);
  if (!ids.length) return [];

  const [members, lines] = await Promise.all([
    db
      .select({
        categoryId: supplierCategoryMembers.categoryId,
        supplierId: supplierCategoryMembers.supplierId,
        position: supplierCategoryMembers.position,
        groups: supplierCategoryMembers.groups,
        printedName: supplierCategoryMembers.printedName,
        name: suppliers.name,
        phone: suppliers.phone,
        address: suppliers.address,
        isActive: suppliers.isActive,
      })
      .from(supplierCategoryMembers)
      .innerJoin(suppliers, eq(suppliers.id, supplierCategoryMembers.supplierId))
      .where(inArray(supplierCategoryMembers.categoryId, ids))
      .orderBy(asc(supplierCategoryMembers.position), asc(suppliers.name)),
    db
      .select()
      .from(supplierCategoryLines)
      .where(inArray(supplierCategoryLines.categoryId, ids))
      .orderBy(asc(supplierCategoryLines.id)),
  ]);

  return categories.map((c) => ({
    id: c.id,
    number: c.number,
    section: c.section,
    reference: c.reference,
    name: c.name,
    groups: c.groups,
    members: members
      .filter((m) => m.categoryId === c.id)
      .map(({ categoryId: _, ...m }) => m),
    lines: lines
      .filter((l) => l.categoryId === c.id)
      .map((l) => ({ key: l.budgetItemId ? `bi:${l.budgetItemId}` : `sp:${l.subProgrammeId}`, groups: l.groups })),
  }));
}

/** A supplier's place on a list: the category, and the headings it's listed under there. */
export interface SupplierCategoryRef {
  number: number;
  name: string;
  groups: string[];
}

/**
 * Each supplier's categories on the list in force in `year`, for the hints in
 * the boxes that suggest suppliers ("2 · Food: maize flour, beans").
 */
export async function categoriesBySupplier(year: number, supplierIds?: number[]) {
  const byId = new Map<number, SupplierCategoryRef[]>();
  const listYear = await listYearFor(year);
  if (listYear === null || (supplierIds && !supplierIds.length)) return byId;
  const rows = await db
    .select({
      supplierId: supplierCategoryMembers.supplierId,
      memberGroups: supplierCategoryMembers.groups,
      number: supplierCategories.number,
      name: supplierCategories.name,
      headings: supplierCategories.groups,
    })
    .from(supplierCategoryMembers)
    .innerJoin(supplierCategories, eq(supplierCategories.id, supplierCategoryMembers.categoryId))
    .where(
      and(
        eq(supplierCategories.year, listYear),
        supplierIds ? inArray(supplierCategoryMembers.supplierId, supplierIds) : undefined
      )
    )
    .orderBy(asc(supplierCategories.number));
  for (const r of rows) {
    const refs = byId.get(r.supplierId) ?? [];
    refs.push({
      number: r.number,
      name: r.name,
      groups: r.memberGroups.map((g) => r.headings[g - 1]).filter((h): h is string => !!h),
    });
    byId.set(r.supplierId, refs);
  }
  return byId;
}
