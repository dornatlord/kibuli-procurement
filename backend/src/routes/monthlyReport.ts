import { asyncRouter } from "../lib/asyncRouter.js";
import { db } from "../db/index.js";
import { monthlyReports, suppliers, users } from "../db/schema.js";
import { and, desc, eq, inArray } from "drizzle-orm";
import { requirePermission } from "../middleware/auth.js";
import { logAudit } from "../lib/audit.js";
import { buildParts } from "./termlyReport.js";

const router = asyncRouter();

/** FORM 2's four parts, in the columns of PPDA's Excel template. Every cell is text, so the school can correct it by hand. */
const PART_COLUMNS = {
  partI: [
    "reference", "subject", "method", "provider", "reserved", "providerCategory", "targetGroup",
    "awardDate", "marketPrice", "bidPrice", "contractValue", "ownership",
  ],
  partII: ["reference", "subject", "provider", "date", "value", "revisedValue"],
  partIII: [
    "reference", "subject", "provider", "reserved", "providerCategory", "completionDate", "amountPaid", "contractValue",
  ],
  partIV: [
    "reference", "subject", "method", "provider", "targetGroup", "awardDate", "invoiceAndDate",
    "marketPrice", "contractValue", "ownership",
  ],
} as const;

type PartKey = keyof typeof PART_COLUMNS;
type Row = Record<string, string>;
type Parts = Record<PartKey, Row[]>;

/** The method names in the template's dropdown; the school's own wording where it differs. */
const METHODS: Record<string, string> = {
  "open international bidding": "Open International Bidding(OIB)",
};
const method = (m: string | undefined) => (m ? METHODS[m.trim().toLowerCase()] ?? m : "");

const CATEGORY: Record<string, string> = { national: "National", foreign: "Foreign", resident: "Resident", eac: "EAC" };

/** "Women / Youth / PWD" → the template's wording; anything else is left for the school to type. */
function targetGroup(raw: string | null | undefined) {
  const t = (raw ?? "").toLowerCase();
  if (!t.trim()) return "";
  if (t.includes("women") || t.includes("woman")) return "Women";
  if (t.includes("youth")) return "Youth";
  if (t.includes("pwd") || t.includes("disab")) return "Person With Disability (PWD)";
  return "";
}

/** A month's FORM 2 filled from the same records as the termly return, plus each provider's category, target group and owners. */
async function buildMonth(year: number, month: number): Promise<Parts> {
  const pad = (n: number) => String(n).padStart(2, "0");
  const start = `${year}-${pad(month)}-01`;
  const end = month === 12 ? `${year + 1}-01-01` : `${year}-${pad(month + 1)}-01`;
  const base = await buildParts(start, end);

  const names = [
    ...new Set(
      [...base.partI, ...base.partIII, ...base.partIV].map((r) => r.provider).filter((n): n is string => !!n)
    ),
  ];
  const found = names.length
    ? await db
        .select({
          name: suppliers.name,
          category: suppliers.providerCategory,
          target: suppliers.targetGroup,
          owners: suppliers.ownerNames,
        })
        .from(suppliers)
        .where(inArray(suppliers.name, names))
    : [];
  const byName = new Map(found.map((s) => [s.name, s]));
  const info = (provider: string | undefined) => {
    const s = provider ? byName.get(provider) : undefined;
    const category = s?.category ? CATEGORY[s.category] ?? "" : "";
    return {
      providerCategory: category,
      // The school reserves for national and resident providers (see Part II of the committee form).
      reserved: !s ? "" : category === "National" || category === "Resident" ? "Yes" : "No",
      targetGroup: targetGroup(s?.target),
      ownership: s?.owners ?? "",
    };
  };

  return {
    partI: base.partI.map((r) => {
      const i = info(r.provider);
      return {
        reference: r.reference,
        subject: r.subject,
        method: method(r.method),
        provider: r.provider,
        reserved: i.reserved,
        providerCategory: i.providerCategory,
        targetGroup: i.targetGroup,
        awardDate: r.awardDate,
        marketPrice: r.marketPrice,
        bidPrice: "",
        contractValue: r.contractValue,
        ownership: i.ownership,
      };
    }),
    partII: base.partII.map((r) => ({
      reference: r.reference,
      subject: r.subject,
      provider: r.provider,
      date: r.date,
      value: r.value,
      revisedValue: r.revisedValue,
    })),
    partIII: base.partIII.map((r) => {
      const i = info(r.provider);
      return {
        reference: r.reference,
        subject: r.subject,
        provider: r.provider,
        reserved: i.reserved,
        providerCategory: i.providerCategory,
        completionDate: r.completionDate,
        amountPaid: r.amountPaid,
        contractValue: r.contractValue,
      };
    }),
    partIV: base.partIV.map((r) => {
      const i = info(r.provider);
      return {
        reference: r.reference,
        subject: r.subject,
        method: "Micro Procurement",
        provider: r.provider,
        targetGroup: i.targetGroup,
        awardDate: r.awardDate ?? "",
        invoiceAndDate: r.invoiceAndDate,
        marketPrice: r.marketPrice ?? "",
        contractValue: r.contractValue,
        ownership: i.ownership,
      };
    }),
  };
}

/** Keeps FORM 2's known columns only, as trimmed text. */
function cleanParts(raw: unknown): Parts | null {
  if (!raw || typeof raw !== "object") return null;
  const parts = {} as Parts;
  for (const key of Object.keys(PART_COLUMNS) as PartKey[]) {
    const rows = (raw as Record<string, unknown>)[key];
    if (!Array.isArray(rows) || rows.length > 1000) return null;
    parts[key] = rows.map((row) => {
      const src = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
      return Object.fromEntries(PART_COLUMNS[key].map((col) => [col, String(src[col] ?? "").trim().slice(0, 500)]));
    });
  }
  return parts;
}

function cleanDeclaration(raw: unknown) {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const text = (k: string) => String(src[k] ?? "").trim().slice(0, 200);
  return { name: text("name"), title: text("title"), date: text("date") };
}

router.get("/", requirePermission("reports.view"), async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const month = Number(req.query.month) || new Date().getMonth() + 1;
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    res.status(400).json({ error: "Choose a month." });
    return;
  }

  const [generated, [saved], [latest]] = await Promise.all([
    buildMonth(year, month),
    db
      .select({
        parts: monthlyReports.parts,
        declaration: monthlyReports.declaration,
        updatedAt: monthlyReports.updatedAt,
        updatedByName: users.name,
      })
      .from(monthlyReports)
      .leftJoin(users, eq(users.id, monthlyReports.updatedBy))
      .where(and(eq(monthlyReports.year, year), eq(monthlyReports.month, month))),
    // The last signatory, to prefill a report nobody has saved yet.
    db.select({ declaration: monthlyReports.declaration }).from(monthlyReports).orderBy(desc(monthlyReports.updatedAt)).limit(1),
  ]);

  res.json({ year, month, generated, saved: saved ?? null, lastDeclaration: latest?.declaration ?? null });
});

router.put("/", requirePermission("reports.prepare"), async (req, res) => {
  const year = Number(req.body?.year);
  const month = Number(req.body?.month);
  if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) {
    res.status(400).json({ error: "Choose a year and month." });
    return;
  }
  const parts = cleanParts(req.body?.parts);
  if (!parts) {
    res.status(400).json({ error: "The report's rows could not be read." });
    return;
  }
  const declaration = cleanDeclaration(req.body?.declaration);
  const userId = req.session.userId!;
  const now = new Date();

  const [row] = await db
    .insert(monthlyReports)
    .values({ year, month, parts, declaration, createdBy: userId, updatedBy: userId, updatedAt: now })
    .onConflictDoUpdate({
      target: [monthlyReports.year, monthlyReports.month],
      set: { parts, declaration, updatedBy: userId, updatedAt: now },
    })
    .returning();
  const [me] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId));

  await logAudit(userId, "monthly_report.saved", "monthly_report", row.id, { year, month });
  res.json({ updatedAt: row.updatedAt, updatedByName: me?.name ?? null });
});

export default router;
