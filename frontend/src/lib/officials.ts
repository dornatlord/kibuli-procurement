import { useEffect, useState } from "react";
import { api } from "./api";

/** An office on the school's forms, and whoever holds it. */
export interface Official {
  key: string;
  label: string;
  defaultTitle: string;
  /** Which forms carry this name, or for an office the school added, what it is responsible for. */
  usedFor: string;
  name: string;
  title: string;
  /** Added by the school rather than printed on a form. */
  custom: boolean;
}

export type Officials = Record<string, { name: string; title: string }>;

/** Only offices with somebody in them, so a blank one never prints a title on its own. */
export const byKey = (rows: Official[]): Officials =>
  Object.fromEntries(rows.filter((o) => o.name).map((o) => [o.key, { name: o.name, title: o.title }]));

/**
 * The office holders whose names print on forms. Starts empty, so a form
 * printed before they load simply leaves those lines blank, as before.
 */
export function useOfficials(): Officials {
  const [officials, setOfficials] = useState<Officials>({});
  useEffect(() => {
    api
      .get<Official[]>("/settings/officials")
      .then((rows) => setOfficials(byKey(rows)))
      .catch(() => {
        // Not set yet, or no connection: the lines stay blank to be filled by hand.
      });
  }, []);
  return officials;
}
