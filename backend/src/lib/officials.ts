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
    usedFor: "TFORM 5, approval to procure · FORM 27, the termly declaration",
  },
  {
    key: "head_teacher",
    label: "Head Teacher",
    defaultTitle: "Head Teacher",
    usedFor: "LPOs, authorised by. Often the same person as the Accounting Officer",
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

export const OFFICIALS_KEY = "officials";

/** Keeps only the offices above, trimmed and length-capped. */
export function cleanOfficials(raw: unknown): Officials {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const officials: Officials = {};
  for (const role of OFFICIAL_ROLES) {
    const value = (src[role.key] ?? {}) as Record<string, unknown>;
    const text = (v: unknown) => String(v ?? "").trim().replace(/\s+/g, " ").slice(0, 120);
    const name = text(value.name);
    const title = text(value.title) || role.defaultTitle;
    if (name) officials[role.key] = { name, title };
  }
  return officials;
}

export async function getOfficials(): Promise<Officials> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, OFFICIALS_KEY));
  return row ? cleanOfficials(row.value) : {};
}

/** Each office with whoever holds it, ready for the settings page and the forms. */
export function withRoles(officials: Officials) {
  return OFFICIAL_ROLES.map((role) => ({
    ...role,
    name: officials[role.key]?.name ?? "",
    title: officials[role.key]?.title || role.defaultTitle,
  }));
}
