import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { appSettings } from "../db/schema.js";

/**
 * The offices whose names are printed on the school's forms. They are entered
 * once, under Officials, and filled in wherever that office signs. People who
 * act on one request — the member of the user department and their head of
 * department — are not here: those names come from the request itself.
 */
export interface OfficialRole {
  key: string;
  label: string;
  /** Printed under the signature line unless a different title is entered. */
  defaultTitle: string;
  /** Where this name appears, shown on the Officials page. */
  usedFor: string;
}

export const OFFICIAL_ROLES: OfficialRole[] = [
  {
    key: "accounting_officer",
    label: "Accounting Officer",
    defaultTitle: "Accounting Officer",
    usedFor: "TFORM 5, approval to procure · FORM 27, the termly declaration · Call-off orders",
  },
  {
    key: "head_teacher",
    label: "Head Teacher",
    defaultTitle: "Head Teacher",
    usedFor: "LPOs, authorised by · Completion certificates, approved by. Often the same person as the Accounting Officer",
  },
  {
    key: "deputy_head_teacher",
    label: "Deputy Head Teacher",
    defaultTitle: "Deputy Headteacher",
    usedFor: "Completion certificates, verified by",
  },
  {
    key: "contract_manager",
    label: "Contract Manager",
    defaultTitle: "Contract Manager",
    usedFor: "Completion certificates, submitted by",
  },
  {
    key: "pdu_head",
    label: "Head of the Procurement and Disposal Unit",
    defaultTitle: "Head, Procurement and Disposal Unit",
    usedFor: "TFORM 5, the Procurement and Disposal Unit's declaration",
  },
  {
    key: "committee_chairperson",
    label: "Contracts Committee Chairperson",
    defaultTitle: "Chairperson, Contracts Committee",
    usedFor: "TFORM 5, the Contracts Committee's declaration",
  },
  {
    key: "committee_secretary",
    label: "Contracts Committee Secretary",
    defaultTitle: "Secretary, Contracts Committee",
    usedFor: "TFORM 5, the Contracts Committee's declaration",
  },
];

export interface Official {
  name: string;
  title: string;
  /**
   * Others who hold the same office, such as a second deputy. The forms fill
   * in `name` and offer these to pick from instead.
   */
  others: string[];
}

export type Officials = Record<string, Official>;

/** An office the school added itself, such as a Bursar or a Storekeeper. */
export interface CustomOfficial {
  key: string;
  /** The office, in capitals: "BURSAR". */
  label: string;
  /** What they are responsible for. */
  usedFor: string;
  name: string;
  title: string;
  others: string[];
}

export const OFFICIALS_KEY = "officials";
const MAX_CUSTOM = 40;
// Names typed on forms are kept too (every member of a department, say), so
// an office can hold a good many.
const MAX_OTHERS = 60;
const BUILT_IN_KEYS = new Set(OFFICIAL_ROLES.map((r) => r.key));

const text = (value: unknown, max: number) =>
  String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, max);

/** The other names in an office: trimmed, without blanks or repeats of each other or the first name. */
function cleanOthers(raw: unknown, first: string): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set([first.toLowerCase()]);
  const out: string[] = [];
  for (const v of raw) {
    const name = text(v, 120);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push(name);
    if (out.length === MAX_OTHERS) break;
  }
  return out;
}

/**
 * Keeps only the offices above, trimmed and length-capped. An office with
 * other names but no first one takes the first of the others.
 */
export function cleanOfficials(raw: unknown): Officials {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const officials: Officials = {};
  for (const role of OFFICIAL_ROLES) {
    const value = (src[role.key] ?? {}) as Record<string, unknown>;
    const [name = "", ...others] = [text(value.name, 120), ...cleanOthers(value.others, "")].filter(Boolean);
    const title = text(value.title, 120) || role.defaultTitle;
    if (name) officials[role.key] = { name, title, others: cleanOthers(others, name) };
  }
  return officials;
}

/** The offices the school added: a title in capitals is required; keys stay stable. */
export function cleanCustom(raw: unknown): CustomOfficial[] {
  if (!Array.isArray(raw)) return [];
  const used = new Set<string>();
  const out: CustomOfficial[] = [];
  for (const entry of raw.slice(0, MAX_CUSTOM)) {
    const e = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
    const label = text(e.label, 60).toUpperCase();
    if (!label) continue;
    const given = typeof e.key === "string" && /^custom-[a-z0-9-]{1,60}$/.test(e.key) ? e.key : "";
    const base =
      given ||
      `custom-${
        label
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 40) || "official"
      }`;
    let key = base;
    for (let n = 2; used.has(key) || BUILT_IN_KEYS.has(key); n++) key = `${base}-${n}`;
    used.add(key);
    const [name = "", ...others] = [text(e.name, 120), ...cleanOthers(e.others, "")].filter(Boolean);
    out.push({
      key,
      label,
      usedFor: text(e.usedFor, 160),
      name,
      title: text(e.title, 120) || label,
      others: cleanOthers(others, name),
    });
  }
  return out;
}

/** "DEPUTY HEAD TEACHER" and "Deputy Head Teacher" are the same office. */
const officeOf = (title: string) => title.toLowerCase().replace(/[^a-z]/g, "");

/** A name filled in on a form, and the office it was filled in for. */
export interface NameToKeep {
  /** The office's key, when the form knows it (the LPO's head teacher). */
  office?: unknown;
  /** Otherwise the title it was filled in under, e.g. "Head of Department". */
  title?: unknown;
  name?: unknown;
}

/**
 * Keeps names filled in on printed forms under the office they were filled
 * in for, so they are offered next time: the office with that key, or whose
 * name or printed title matches the title, or else a new office under that
 * title. A name the office already has is left alone. Changes `offices` and
 * returns the offices the school added, with what was kept ("Ssali Taufiq,
 * HEAD OF DEPARTMENT").
 */
export function keepNames(offices: Officials, custom: CustomOfficial[], entries: NameToKeep[]) {
  const kept: string[] = [];
  let added = [...custom];
  const addTo = (holder: { name: string; others: string[] }, name: string) => {
    const known = [holder.name, ...holder.others].some((n) => n.toLowerCase() === name.toLowerCase());
    if (known || (holder.name && holder.others.length >= MAX_OTHERS)) return false;
    if (holder.name) holder.others.push(name);
    else holder.name = name;
    return true;
  };
  for (const e of entries) {
    const name = text(e.name, 120);
    const key = typeof e.office === "string" ? e.office : "";
    const title = text(e.title, 60);
    const wanted = officeOf(title);
    if (!name || (!key && !wanted)) continue;

    const role = OFFICIAL_ROLES.find((r) =>
      key ? r.key === key : officeOf(r.label) === wanted || officeOf(offices[r.key]?.title || r.defaultTitle) === wanted
    );
    if (role) {
      const office = offices[role.key] ?? (offices[role.key] = { name: "", title: role.defaultTitle, others: [] });
      if (addTo(office, name)) kept.push(`${name}, ${role.label}`);
      continue;
    }
    const mine = added.find((c) => (key ? c.key === key : officeOf(c.label) === wanted || officeOf(c.title) === wanted));
    if (mine) {
      if (addTo(mine, name)) kept.push(`${name}, ${mine.label}`);
    } else if (!key && added.length < MAX_CUSTOM) {
      added.push({
        key: "",
        label: title.toUpperCase(),
        usedFor: "Kept from a printed form, to pick from next time",
        name,
        title,
        others: [],
      });
      kept.push(`${name}, ${title.toUpperCase()}`);
    }
  }
  // Gives the new offices their keys, the same way as the Officials page.
  added = cleanCustom(added);
  return { custom: added, kept };
}

/** Everything saved under Officials: the offices on the forms, and those the school added. */
export async function loadOfficials(): Promise<{ offices: Officials; custom: CustomOfficial[] }> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, OFFICIALS_KEY));
  const value = row?.value && typeof row.value === "object" ? (row.value as Record<string, unknown>) : {};
  return { offices: cleanOfficials(value), custom: cleanCustom(value._custom) };
}

/** Each office with whoever holds it, ready for the Officials page and the forms. */
export function listOfficials(offices: Officials, custom: CustomOfficial[]) {
  return [
    ...OFFICIAL_ROLES.map((role) => ({
      ...role,
      custom: false,
      name: offices[role.key]?.name ?? "",
      title: offices[role.key]?.title || role.defaultTitle,
      others: offices[role.key]?.others ?? [],
    })),
    ...custom.map((c) => ({
      key: c.key,
      label: c.label,
      defaultTitle: c.label,
      usedFor: c.usedFor,
      custom: true,
      name: c.name,
      title: c.title,
      others: c.others,
    })),
  ];
}
