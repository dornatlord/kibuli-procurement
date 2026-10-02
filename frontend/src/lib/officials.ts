import { useEffect, useState } from "react";
import { api } from "./api";
import type { ComboOption } from "../components/Combobox";

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
  /** The names a form's name box may take off its list (all but the office holder entered here). */
  removable?: string[];
}

/**
 * Each office with somebody in it: the name the forms fill in, its title, and
 * everyone holding the office (that name first), to pick from before printing.
 * `removable` is the office's own names that a name box may take off its list.
 */
export type Officials = Record<
  string,
  { name: string; title: string; label: string; names: string[]; removable: string[] }
>;

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
          label: o.label,
          names: [...new Set([o.name, ...(o.others ?? []), ...(sameTitle.get(officeOf(o.label)) ?? [])])],
          removable: o.removable ?? [],
        },
      ])
  );
};

/** Everyone holding these offices, without repeats: the choices for a name before printing. */
export function namesIn(officials: Officials, ...keys: string[]): string[] {
  return [...new Set(keys.flatMap((k) => officials[k]?.names ?? []))];
}

/** The offices named a title, such as "Head of Department", or printing it as their title. */
function officesUnder(officials: Officials, title: string) {
  const wanted = officeOf(title);
  if (!wanted) return [];
  return Object.values(officials).filter((o) => officeOf(o.label) === wanted || officeOf(o.title) === wanted);
}

/** Everyone kept under a title, such as "Head of Department". */
export function namesForTitle(officials: Officials, title: string): string[] {
  return [...new Set(officesUnder(officials, title).flatMap((o) => o.names))];
}

/**
 * The choices for a name box with its title chosen beside it: everyone kept
 * under that title, with an × on those the box may take off its list, then
 * `more` (the people on the request, office holders), which always stay. An
 * office holder entered on the Officials page never gets an ×.
 */
export function nameChoices(officials: Officials, title: string, ...more: (string | ComboOption)[]): ComboOption[] {
  const offices = officesUnder(officials, title);
  const removable = new Set(offices.flatMap((o) => o.removable));
  const stays = new Set([
    ...offices.filter((o) => !o.removable.includes(o.name)).map((o) => o.name),
    ...more.map((m) => (typeof m === "string" ? m : m.value)),
  ]);
  return [
    ...namesForTitle(officials, title).map((name) => ({ value: name, removable: removable.has(name) && !stays.has(name) })),
    ...more.map((m) => (typeof m === "string" ? { value: m } : m)),
  ];
}

const CHANGED = "kibuli:officials-changed";

/**
 * Takes a name off the lists offered under a title, after the person has said
 * they're sure: for someone kept once (a member who signed one request) who
 * won't sign again. The name boxes load again without it.
 */
export function forgetName(title: string, name: string) {
  api
    .post("/settings/officials/forget", { title, name })
    .then(() => window.dispatchEvent(new Event(CHANGED)))
    .catch((err) =>
      window.alert(`${name} couldn't be removed: ${err instanceof Error ? err.message : "try again when you're online"}.`)
    );
}

/** A name filled in on a form, with the office (by key) or the title it was filled in under. */
export interface NameToKeep {
  office?: string;
  title?: string;
  name: string;
}

/**
 * Keeps names filled in on a form under their office in Officials, so the
 * name boxes offer them next time ("Ssali Taufiq" under Head of Department).
 * It runs after printing and never stands in its way: offline, or without
 * the right, the names simply aren't kept.
 */
export function keepNames(names: (NameToKeep | false | null | undefined)[]) {
  const worth = names.filter((n): n is NameToKeep => !!n && !!n.name.trim() && !!(n.office || n.title?.trim()));
  if (worth.length === 0) return;
  api
    .post("/settings/officials/remember", { names: worth })
    .then(() => window.dispatchEvent(new Event(CHANGED)))
    .catch(() => {});
}

/**
 * The office holders whose names print on forms. Starts empty, so a form
 * printed before they load simply leaves those lines blank, as before. It
 * loads again whenever a form keeps new names.
 */
export function useOfficials(): Officials {
  const [officials, setOfficials] = useState<Officials>({});
  useEffect(() => {
    const load = () =>
      api
        .get<Official[]>("/settings/officials")
        .then((rows) => setOfficials(byKey(rows)))
        .catch(() => {
          // Not set yet, or no connection: the lines stay blank to be filled by hand.
        });
    load();
    window.addEventListener(CHANGED, load);
    return () => window.removeEventListener(CHANGED, load);
  }, []);
  return officials;
}
