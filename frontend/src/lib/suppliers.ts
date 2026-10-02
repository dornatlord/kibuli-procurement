import { useEffect, useState } from "react";
import { api } from "./api";
import type { ComboOption } from "../components/Combobox";

/** A supplier as the boxes that suggest suppliers need it. */
export interface SupplierName {
  id: number;
  name: string;
  /** On this year's list of suppliers, rather than only an earlier year's. */
  onThisYearsList: boolean;
}

/**
 * Every active supplier's name, this year's list first, for the boxes where a
 * supplier is typed (Part II's shortlisted providers, a call-off order's
 * provider). Loads once `enabled`; empty until then, or if it can't load, so
 * the box still takes whatever is typed.
 */
export function useSupplierNames(enabled = true): SupplierName[] {
  const [names, setNames] = useState<SupplierName[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    api
      .get<SupplierName[]>("/suppliers/names")
      .then((rows) => live && setNames(rows))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [enabled]);
  return names;
}

/** The suppliers as choices for a box, those only on an earlier year's list marked. */
export function supplierChoices(names: SupplierName[]): ComboOption[] {
  return names.map((s) => ({ value: s.name, hint: s.onThisYearsList ? undefined : "Not on this year's list" }));
}
