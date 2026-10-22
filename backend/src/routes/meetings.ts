import { asyncRouter } from "../lib/asyncRouter.js";
import { db } from "../db/index.js";
import {
  committeeMeetings,
  committeeMeetingItems,
  contractsCommitteeDecisions,
  procurementRequests,
  users,
} from "../db/schema.js";
import { and, asc, desc, eq, inArray, like, sql } from "drizzle-orm";
import { requirePermission } from "../middleware/auth.js";
import { logAudit } from "../lib/audit.js";
import { textFrom } from "../lib/corrections.js";

/**
 * The Contracts Committee's meeting minutes. A meeting records who attended,
 * what was said about the last minutes and anything arising, each matter
 * taken (often a macro request, with the decision reached), other business,
 * and who signs. It's a draft the secretary can keep editing; finalising
 * locks it, and only someone who may correct records can reopen it.
 */
const router = asyncRouter();

const ATTENDEE_STATUS = ["present", "apology", "absent", "in_attendance"] as const;
const DECISIONS = ["approved", "rejected", "deferred", "noted"] as const;
const MEETING_TYPES = ["ordinary", "special"] as const;

const isDate = (v: unknown): v is string => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
};
const isTime = (v: unknown): v is string => typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const dateOrNull = (v: unknown) => (v === undefined || v === null || String(v).trim() === "" ? null : String(v).trim());

interface Attendee {
  name: string;
  title: string;
  status: (typeof ATTENDEE_STATUS)[number];
}
interface ItemIn {
  requestId: number | null;
  title: string;
  discussion: string | null;
  decision: (typeof DECISIONS)[number] | null;
  resolution: string | null;
  conditions: string | null;
}

/** The meeting's fields from the body, or what's wrong with them. */
function readMeeting(body: Record<string, any>) {
  const meetingDate = dateOrNull(body.meetingDate);
  if (!meetingDate || !isDate(meetingDate)) return { error: "Enter the date of the meeting." } as const;
  const nextMeetingDate = dateOrNull(body.nextMeetingDate);
  if (nextMeetingDate && !isDate(nextMeetingDate)) return { error: "The next meeting's date isn't a date." } as const;
  const startTime = dateOrNull(body.startTime);
  const endTime = dateOrNull(body.endTime);
  if ((startTime && !isTime(startTime)) || (endTime && !isTime(endTime))) {
    return { error: "Times are written like 14:30." } as const;
  }
  const meetingType = MEETING_TYPES.includes(body.meetingType) ? body.meetingType : "ordinary";

  const attendeesRaw = Array.isArray(body.attendees) ? body.attendees : [];
  if (attendeesRaw.length > 60) return { error: "That's more attendees than one meeting can hold." } as const;
  const attendees: Attendee[] = [];
  for (const [i, a] of attendeesRaw.entries()) {
    const name = textFrom(a?.name, 120);
    if (!name) return { error: `Attendee ${i + 1} needs a name.` } as const;
    attendees.push({
      name,
      title: textFrom(a?.title, 120) ?? "",
      status: ATTENDEE_STATUS.includes(a?.status) ? a.status : "present",
    });
  }

  const itemsRaw = Array.isArray(body.items) ? body.items : [];
  if (itemsRaw.length > 80) return { error: "That's more matters than one meeting can hold." } as const;
  const items: ItemIn[] = [];
  const seen = new Set<number>();
  for (const [i, it] of itemsRaw.entries()) {
    const title = textFrom(it?.title, 300);
    if (!title) return { error: `Matter ${i + 1} needs a title.` } as const;
    const requestId = Number.isInteger(Number(it?.requestId)) && Number(it.requestId) > 0 ? Number(it.requestId) : null;
    if (requestId) {
      if (seen.has(requestId)) return { error: `Matter ${i + 1}: that request is already on the agenda.` } as const;
      seen.add(requestId);
    }
    items.push({
      requestId,
      title,
      discussion: textFrom(it?.discussion, 6000),
      decision: DECISIONS.includes(it?.decision) ? it.decision : null,
      resolution: textFrom(it?.resolution, 3000),
      conditions: textFrom(it?.conditions, 3000),
    });
  }

  return {
    meeting: {
      meetingType,
      meetingDate,
      startTime,
      endTime,
      venue: textFrom(body.venue, 200),
      attendees,
      opening: textFrom(body.opening, 6000),
      previousMinutes: textFrom(body.previousMinutes, 6000),
      mattersArising: textFrom(body.mattersArising, 6000),
      otherBusiness: textFrom(body.otherBusiness, 6000),
      nextMeetingDate,
      chairName: textFrom(body.chairName, 120),
      secretaryName: textFrom(body.secretaryName, 120),
    },
    items,
  } as const;
}

/** What has to be there before minutes are final. */
function notReady(m: { attendees: Attendee[]; chairName: string | null; secretaryName: string | null }, items: ItemIn[]) {
  const gaps: string[] = [];
  if (!m.attendees.some((a) => a.status === "present")) gaps.push("who was present");
  if (!m.chairName) gaps.push("the chairperson");
  if (!m.secretaryName) gaps.push("the secretary");
  items.forEach((it, i) => {
    if (!it.decision) gaps.push(`the decision on matter ${i + 1}`);
  });
  return gaps;
}

/** KSS/CC/26/001: numbered within the year of the meeting. */
async function nextReference(meetingDate: string) {
  const prefix = `KSS/CC/${meetingDate.slice(2, 4)}/`;
  const rows = await db
    .select({ ref: committeeMeetings.referenceNumber })
    .from(committeeMeetings)
    .where(like(committeeMeetings.referenceNumber, `${prefix}%`));
  const last = rows.reduce((max, r) => Math.max(max, Number(r.ref.slice(prefix.length)) || 0), 0);
  return `${prefix}${String(last + 1).padStart(3, "0")}`;
}

const isUniqueViolation = (err: unknown) => ((err as any)?.code ?? (err as any)?.cause?.code) === "23505";

/** Meetings, newest first, with how many matters each took. */
router.get("/", requirePermission("meetings.view"), async (req, res) => {
  const year = Number(req.query.year);
  const rows = await db
    .select({
      id: committeeMeetings.id,
      referenceNumber: committeeMeetings.referenceNumber,
      meetingType: committeeMeetings.meetingType,
      meetingDate: committeeMeetings.meetingDate,
      venue: committeeMeetings.venue,
      status: committeeMeetings.status,
      itemCount: sql<number>`(select count(*)::int from committee_meeting_items i where i.meeting_id = ${committeeMeetings.id})`,
    })
    .from(committeeMeetings)
    .where(Number.isInteger(year) && year > 2000 ? sql`extract(year from ${committeeMeetings.meetingDate}) = ${year}` : undefined)
    .orderBy(desc(committeeMeetings.meetingDate), desc(committeeMeetings.id));
  res.json(rows);
});

/**
 * Macro requests waiting on the committee, to put on a meeting's agenda, each
 * with what the PDU put to the committee (method and shortlisted providers).
 */
router.get("/pending-requests", requirePermission("meetings.manage"), async (_req, res) => {
  const rows = await db
    .select({
      id: procurementRequests.id,
      referenceNumber: procurementRequests.referenceNumber,
      subject: procurementRequests.subjectOfProcurement,
      total: procurementRequests.estimatedTotalCost,
      status: procurementRequests.status,
      recommendedMethod: contractsCommitteeDecisions.recommendedMethod,
      shortlistedProviders: contractsCommitteeDecisions.shortlistedProviders,
    })
    .from(procurementRequests)
    .leftJoin(contractsCommitteeDecisions, eq(contractsCommitteeDecisions.procurementRequestId, procurementRequests.id))
    .where(and(eq(procurementRequests.procurementSize, "macro"), eq(procurementRequests.status, "pending_contracts_committee")))
    .orderBy(asc(procurementRequests.id));
  res.json(rows);
});

/** A new meeting starts from the last one: the same members, venue, chairperson and secretary. */
router.get("/template", requirePermission("meetings.manage"), async (_req, res) => {
  const [last] = await db.select().from(committeeMeetings).orderBy(desc(committeeMeetings.meetingDate), desc(committeeMeetings.id)).limit(1);
  res.json({
    attendees: ((last?.attendees as Attendee[] | undefined) ?? []).map((a) => ({
      ...a,
      status: a.status === "in_attendance" ? "in_attendance" : "present",
    })),
    venue: last?.venue ?? null,
    chairName: last?.chairName ?? null,
    secretaryName: last?.secretaryName ?? null,
    lastMeetingDate: last?.meetingDate ?? null,
  });
});

router.get("/:id", requirePermission("meetings.view"), async (req, res) => {
  const id = Number(req.params.id);
  const [meeting] = await db.select().from(committeeMeetings).where(eq(committeeMeetings.id, id));
  if (!meeting) {
    res.status(404).json({ error: "Meeting not found" });
    return;
  }
  const items = await db
    .select({
      id: committeeMeetingItems.id,
      requestId: committeeMeetingItems.requestId,
      title: committeeMeetingItems.title,
      discussion: committeeMeetingItems.discussion,
      decision: committeeMeetingItems.decision,
      resolution: committeeMeetingItems.resolution,
      conditions: committeeMeetingItems.conditions,
      referenceNumber: procurementRequests.referenceNumber,
      requestSubject: procurementRequests.subjectOfProcurement,
      total: procurementRequests.estimatedTotalCost,
      requestStatus: procurementRequests.status,
      recommendedMethod: contractsCommitteeDecisions.recommendedMethod,
      shortlistedProviders: contractsCommitteeDecisions.shortlistedProviders,
    })
    .from(committeeMeetingItems)
    .leftJoin(procurementRequests, eq(procurementRequests.id, committeeMeetingItems.requestId))
    .leftJoin(contractsCommitteeDecisions, eq(contractsCommitteeDecisions.procurementRequestId, committeeMeetingItems.requestId))
    .where(eq(committeeMeetingItems.meetingId, id))
    .orderBy(asc(committeeMeetingItems.position));
  const [by] = meeting.finalizedBy ? await db.select({ name: users.name }).from(users).where(eq(users.id, meeting.finalizedBy)) : [null];
  res.json({ ...meeting, items, finalizedByName: by?.name ?? null });
});

/** Writes a meeting's matters, replacing any it had. */
async function saveItems(tx: typeof db, meetingId: number, items: ItemIn[]) {
  await tx.delete(committeeMeetingItems).where(eq(committeeMeetingItems.meetingId, meetingId));
  if (items.length) {
    await tx.insert(committeeMeetingItems).values(items.map((it, n) => ({ meetingId, position: n + 1, ...it })));
  }
}

router.post("/", requirePermission("meetings.manage"), async (req, res) => {
  const parsed = readMeeting(req.body ?? {});
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  let created: typeof committeeMeetings.$inferSelect | undefined;
  for (let attempt = 1; !created; attempt++) {
    const referenceNumber = await nextReference(parsed.meeting.meetingDate);
    try {
      created = await db.transaction(async (tx) => {
        const [row] = await tx
          .insert(committeeMeetings)
          .values({ ...parsed.meeting, referenceNumber, createdBy: req.session.userId! })
          .returning();
        await saveItems(tx as unknown as typeof db, row.id, parsed.items);
        return row;
      });
    } catch (err) {
      if (!isUniqueViolation(err) || attempt >= 5) throw err;
    }
  }
  await logAudit(req.session.userId!, "meeting.created", "committee_meeting", created.id, {
    referenceNumber: created.referenceNumber,
  });
  res.status(201).json(created);
});

router.put("/:id", requirePermission("meetings.manage"), async (req, res) => {
  const id = Number(req.params.id);
  const [meeting] = await db.select().from(committeeMeetings).where(eq(committeeMeetings.id, id));
  if (!meeting) {
    res.status(404).json({ error: "Meeting not found" });
    return;
  }
  if (meeting.status === "final") {
    res.status(409).json({ error: "These minutes are final. Ask someone allowed to correct records to reopen them." });
    return;
  }
  const parsed = readMeeting(req.body ?? {});
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  await db.transaction(async (tx) => {
    await tx.update(committeeMeetings).set({ ...parsed.meeting, updatedAt: new Date() }).where(eq(committeeMeetings.id, id));
    await saveItems(tx as unknown as typeof db, id, parsed.items);
  });
  await logAudit(req.session.userId!, "meeting.updated", "committee_meeting", id, { referenceNumber: meeting.referenceNumber });
  res.json({ ok: true });
});

/** Locks the minutes once they're complete. */
router.post("/:id/finalize", requirePermission("meetings.manage"), async (req, res) => {
  const id = Number(req.params.id);
  const [meeting] = await db.select().from(committeeMeetings).where(eq(committeeMeetings.id, id));
  if (!meeting) {
    res.status(404).json({ error: "Meeting not found" });
    return;
  }
  if (meeting.status === "final") {
    res.status(409).json({ error: "These minutes are already final." });
    return;
  }
  const items = await db.select().from(committeeMeetingItems).where(eq(committeeMeetingItems.meetingId, id));
  const gaps = notReady(
    { attendees: meeting.attendees as Attendee[], chairName: meeting.chairName, secretaryName: meeting.secretaryName },
    items.map((i) => ({ ...i, decision: (i.decision as ItemIn["decision"]) ?? null }))
  );
  if (gaps.length) {
    res.status(400).json({ error: `Before the minutes are final, fill in: ${gaps.join("; ")}.`, missing: gaps });
    return;
  }
  await db
    .update(committeeMeetings)
    .set({ status: "final", finalizedBy: req.session.userId!, finalizedAt: new Date(), updatedAt: new Date() })
    .where(eq(committeeMeetings.id, id));
  await logAudit(req.session.userId!, "meeting.finalized", "committee_meeting", id, { referenceNumber: meeting.referenceNumber });
  res.json({ ok: true });
});

/** Only someone who may correct records can reopen final minutes, saying why. */
router.post("/:id/reopen", requirePermission("records.correct"), async (req, res) => {
  const id = Number(req.params.id);
  const reason = textFrom(req.body?.reason, 500);
  if (!reason || reason.length < 3) {
    res.status(400).json({ error: "Say why the minutes are being reopened." });
    return;
  }
  const [meeting] = await db.select().from(committeeMeetings).where(eq(committeeMeetings.id, id));
  if (!meeting || meeting.status !== "final") {
    res.status(404).json({ error: "No final minutes to reopen." });
    return;
  }
  await db
    .update(committeeMeetings)
    .set({ status: "draft", finalizedBy: null, finalizedAt: null, updatedAt: new Date() })
    .where(eq(committeeMeetings.id, id));
  await logAudit(req.session.userId!, "meeting.reopened", "committee_meeting", id, {
    referenceNumber: meeting.referenceNumber,
    reason,
  });
  res.json({ ok: true });
});

/** Only a draft can be deleted; final minutes are a record. */
router.delete("/:id", requirePermission("meetings.manage"), async (req, res) => {
  const id = Number(req.params.id);
  const [meeting] = await db.select().from(committeeMeetings).where(eq(committeeMeetings.id, id));
  if (!meeting) {
    res.status(404).json({ error: "Meeting not found" });
    return;
  }
  if (meeting.status === "final") {
    res.status(409).json({ error: "Final minutes can't be deleted." });
    return;
  }
  await db.delete(committeeMeetings).where(eq(committeeMeetings.id, id));
  await logAudit(req.session.userId!, "meeting.deleted", "committee_meeting", id, { referenceNumber: meeting.referenceNumber });
  res.json({ ok: true });
});

export default router;
