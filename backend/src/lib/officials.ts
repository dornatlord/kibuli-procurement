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
}

export const OFFICIALS_KEY = "officials";
const MAX_CUSTOM = 40;
const BUILT_IN_KEYS = new Set(OFFICIAL_ROLES.map((r) => r.key));

const text = (value: unknown, max: number) =>
  String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, max);

/** Keeps only the offices above, trimmed and length-capped. */
export function cleanOfficials(raw: unknown): Officials {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const officials: Officials = {};
  for (const role of OFFICIAL_ROLES) {
    const value = (src[role.key] ?? {}) as Record<string, unknown>;
    const name = text(value.name, 120);
    const title = text(value.title, 120) || role.defaultTitle;
    if (name) officials[role.key] = { name, title };
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
    out.push({
      key,
      label,
      usedFor: text(e.usedFor, 160),
      name: text(e.name, 120),
      title: text(e.title, 120) || label,
    });
  }
  return out;
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
    })),
    ...custom.map((c) => ({
      key: c.key,
      label: c.label,
      defaultTitle: c.label,
      usedFor: c.usedFor,
      custom: true,
      name: c.name,
      title: c.title,
    })),
  ];
}
