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
  /** Others who hold the same office, such as a second deputy; offered to pick from on the forms. */
  others: string[];
  /** Added by the school rather than printed on a form. */
  custom: boolean;
}

/**
 * Each office with somebody in it: the name the forms fill in, its title, and
 * everyone holding the office (that name first), to pick from before printing.
 */
export type Officials = Record<string, { name: string; title: string; names: string[] }>;

/** "DEPUTY HEAD TEACHER" and "Deputy Head Teacher" are the same office. */
const officeOf = (label: string) => label.toLowerCase().replace(/[^a-z]/g, "");

/**
 * Only offices with somebody in them, so a blank one never prints a title on
 * its own. An office's names include those of any office the school added
 * under the same title, such as a second Deputy Head Teacher.
 */
export const byKey = (rows: Official[]): Officials => {
  const sameTitle = new Map<string, string[]>();
  for (const o of rows) {
    const office = officeOf(o.label);
    sameTitle.set(office, [...(sameTitle.get(office) ?? []), o.name, ...(o.others ?? [])].filter(Boolean));
  }
  return Object.fromEntries(
    rows
      .filter((o) => o.name)
      .map((o) => [
        o.key,
        {
          name: o.name,
          title: o.title,
          names: [...new Set([o.name, ...(o.others ?? []), ...(sameTitle.get(officeOf(o.label)) ?? [])])],
        },
      ])
  );
};

/** Everyone holding these offices, without repeats: the choices for a name before printing. */
export function namesIn(officials: Officials, ...keys: string[]): string[] {
  return [...new Set(keys.flatMap((k) => officials[k]?.names ?? []))];
}

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
