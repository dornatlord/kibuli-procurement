import { sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { supplierYears, suppliers } from "../db/schema.js";

/** Puts suppliers on a year's list; those already on it are left as they are. Returns who was added. */
export async function putOnYearsList(supplierIds: number[], year: number, userId: number | null) {
  if (!supplierIds.length) return [];
  return db
    .insert(supplierYears)
    .values(supplierIds.map((supplierId) => ({ supplierId, year, addedBy: userId })))
    .onConflictDoNothing()
    .returning({ supplierId: supplierYears.supplierId });
}

/** A supplier's years on the list, oldest first, as an SQL expression for a select. */
export const yearsOnList = sql<number[]>`coalesce((
  select array_agg(sy.year order by sy.year) from supplier_years sy where sy.supplier_id = ${suppliers.id}
), '{}')`;
