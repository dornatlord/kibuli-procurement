import { cornerBadge, esc, flowCss, frameClose, frameOpen, money, openPrint } from "../print";

export type AttendeeStatus = "present" | "apology" | "absent" | "in_attendance";
export type Decision = "approved" | "rejected" | "deferred" | "noted";

export interface Attendee {
  name: string;
  title: string;
  status: AttendeeStatus;
}

export interface MeetingItem {
  id?: number;
  requestId: number | null;
  title: string;
  discussion: string | null;
  decision: Decision | null;
  resolution: string | null;
  conditions: string | null;
  // From the request it names, when it names one.
  referenceNumber?: string | null;
  requestSubject?: string | null;
  total?: string | null;
  requestStatus?: string | null;
  recommendedMethod?: string | null;
  shortlistedProviders?: string | null;
}

export interface Meeting {
  id: number;
  referenceNumber: string;
  meetingType: "ordinary" | "special";
  meetingDate: string;
  startTime: string | null;
  endTime: string | null;
  venue: string | null;
  attendees: Attendee[];
  opening: string | null;
  previousMinutes: string | null;
  mattersArising: string | null;
  otherBusiness: string | null;
  nextMeetingDate: string | null;
  chairName: string | null;
  secretaryName: string | null;
  status: "draft" | "final";
  finalizedAt: string | null;
  finalizedByName: string | null;
  items: MeetingItem[];
}

export const ATTENDEE_LABELS: Record<AttendeeStatus, string> = {
  present: "Present",
  apology: "Apologies",
  absent: "Absent",
  in_attendance: "In attendance",
};

export const DECISION_LABELS: Record<Decision, string> = {
  approved: "Approved",
  rejected: "Rejected",
  deferred: "Deferred",
  noted: "Noted",
};

/** "2026-10-22" → "Thursday, 22 October 2026". */
export function longDate(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

/** "14:30" → "2:30 PM". */
export function clock(value: string | null | undefined): string {
  if (!value) return "";
  const [h, m] = value.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return "";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** A starting resolution for a matter, to be edited. */
export function suggestResolution(item: MeetingItem, decision: Decision | null): string {
  if (!decision) return "";
  const what = item.referenceNumber
    ? `the procurement of “${item.requestSubject ?? item.title}” (${item.referenceNumber})${item.total ? `, estimated at UGX ${money(item.total)}` : ""}`
    : `“${item.title}”`;
  const verb = { approved: "approved", rejected: "not approved", deferred: "deferred to the next meeting", noted: "noted" }[decision];
  return `RESOLVED that ${what} be ${verb}.`;
}

/** Typed text keeps its line breaks. */
const lines = (s: string | null | undefined) => esc(s).replace(/\n/g, "<br/>");

/** The minutes as a printed document, signed by the chairperson and the secretary. */
export function printMinutes(m: Meeting) {
  const group = (status: AttendeeStatus) => m.attendees.filter((a) => a.status === status);
  const table = (title: string, rows: Attendee[]) =>
    rows.length
      ? `<h3>${title}</h3>
<table class="people"><tr><th style="width:9%">No.</th><th style="width:46%">Name</th><th>Title</th></tr>
${rows.map((a, i) => `<tr><td class="c">${i + 1}</td><td>${esc(a.name)}</td><td>${esc(a.title)}</td></tr>`).join("")}</table>`
      : "";

  const itemsHtml = (sec: number) => m.items
    .map((it, i) => {
      const meta = [
        it.referenceNumber ? `Request ${esc(it.referenceNumber)}` : "",
        it.total ? `Estimated cost UGX ${money(it.total)}` : "",
        it.recommendedMethod ? `Method recommended: ${esc(it.recommendedMethod)}` : "",
        it.shortlistedProviders ? `Shortlisted: ${esc(it.shortlistedProviders).replace(/\n/g, "; ")}` : "",
      ].filter(Boolean);
      return `<div class="matter">
<p class="mt"><b>${sec}.${i + 1}&nbsp; ${esc(it.title)}</b></p>
${meta.length ? `<p class="meta">${meta.join(" &middot; ")}</p>` : ""}
${it.discussion ? `<p>${lines(it.discussion)}</p>` : ""}
${it.decision ? `<p><b>Decision: ${DECISION_LABELS[it.decision].toUpperCase()}.</b> ${lines(it.resolution)}</p>` : ""}
${it.conditions ? `<p><i>Conditions:</i> ${lines(it.conditions)}</p>` : ""}
</div>`;
    })
    .join("");

  // Sections are numbered in the order they appear; one with nothing in it is left out, not skipped over.
  let no = 0;
  const section = (title: string, body: string | null | undefined, fallback?: string) =>
    body || fallback ? `<h3>${++no}.&nbsp; ${title}</h3><p>${body ? lines(body) : fallback}</p>` : "";

  const sections: string[] = [
    section("Call to order and opening", m.opening, `The chairperson called the meeting to order${m.startTime ? ` at ${clock(m.startTime)}` : ""}.`),
    section("Confirmation of the previous minutes", m.previousMinutes),
    section("Matters arising", m.mattersArising),
  ];
  if (m.items.length) sections.push(`<h3>${++no}.&nbsp; Matters before the committee</h3>${itemsHtml(no)}`);
  sections.push(section("Any other business", m.otherBusiness));
  const closure = `<h3>${++no}.&nbsp; Closure</h3><p class="cl">There being no other business, the chairperson closed the meeting${m.endTime ? ` at ${clock(m.endTime)}` : ""}.${
    m.nextMeetingDate ? ` The next meeting will be held on ${esc(longDate(m.nextMeetingDate))}.` : ""
  }</p>`;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Minutes — ${esc(m.referenceNumber)}</title>
<style>
${flowCss("portrait")}
body { font-family: "Times New Roman", Times, serif; font-size: 12pt; line-height: 1.3; }
.top { text-align: center; margin-bottom: 5mm; }
.top .school { font-size: 15pt; font-weight: bold; }
.top .what { font-size: 13pt; font-weight: bold; margin-top: 1mm; }
.top .when { margin-top: 1.5mm; }
.top .draft { display: inline-block; margin-top: 2mm; padding: 0 3mm; border: 1.5px solid #b00; color: #b00; font-weight: bold; letter-spacing: 0.1em; }
h3 { font-size: 12pt; margin: 5mm 0 1.5mm; break-after: avoid; page-break-after: avoid; }
p { margin: 0 0 2mm; text-align: justify; }
.cl { break-after: avoid; page-break-after: avoid; }
.meta { font-size: 10.5pt; color: #333; }
.matter { margin: 0 0 3mm 7mm; break-inside: avoid; }
.mt { margin-bottom: 1mm; }
table.people { width: 100%; border-collapse: collapse; margin-bottom: 2mm; }
table.people td, table.people th { border: 1px solid #000; padding: 1mm 2mm; font-size: 11.5pt; text-align: left; }
table.people th { text-align: center; }
.c { text-align: center !important; }
table.sign { width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 12mm; break-inside: avoid; page-break-inside: avoid; }
table.sign td { width: 50%; padding: 0 7mm 0 0; vertical-align: top; border: 0; }
table.sign td + td { padding: 0 0 0 7mm; }
table.sign .line { border-bottom: 1px solid #000; height: 11mm; }
table.sign .who { margin-top: 1.5mm; }
</style></head><body>
${cornerBadge}
${frameOpen}
<div class="top">
  <div class="school">KIBULI SECONDARY SCHOOL</div>
  <div class="what">MINUTES OF THE ${m.meetingType === "special" ? "SPECIAL" : "ORDINARY"} MEETING OF THE CONTRACTS COMMITTEE</div>
  <div class="when">${esc(m.referenceNumber)}</div>
  <div class="when">Held on ${esc(longDate(m.meetingDate))}${m.venue ? ` at ${esc(m.venue)}` : ""}${m.startTime ? `, from ${clock(m.startTime)}` : ""}${m.endTime ? ` to ${clock(m.endTime)}` : ""}</div>
  ${m.status === "draft" ? '<div class="draft">DRAFT</div>' : ""}
</div>
${table("Members present", group("present"))}
${table("Apologies", group("apology"))}
${table("Absent", group("absent"))}
${table("In attendance", group("in_attendance"))}
${sections.join("\n")}
${closure}
<table class="sign"><tr>
  <td><div class="line"></div><div class="who"><b>${esc(m.chairName)}</b><br/>Chairperson<br/>Date: ____ / ____ / ________</div></td>
  <td><div class="line"></div><div class="who"><b>${esc(m.secretaryName)}</b><br/>Secretary<br/>Date: ____ / ____ / ________</div></td>
</tr></table>
${frameClose}
</body></html>`;
  openPrint(html);
}

