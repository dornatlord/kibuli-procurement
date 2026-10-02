import { KSS_BADGE } from "../badge";
import { shillingsInWords } from "../words";
import type { Officials } from "../officials";
import { DEFAULT_JUSTIFICATION } from "../../components/PartTwoForm";
import { cornerBadge, dayFirst, esc, kampalaDay, money, openPrint, sheetCss, tableSheets } from "../print";

export interface RequestLineItem {
  id: number;
  itemNo: number;
  description: string;
  quantity: string;
  unitOfMeasure: string;
  estimatedUnitCost: string;
  marketPrice: string;
  totalCost: string;
}

export interface RequestSignature {
  id: number;
  role: string;
  name: string;
  title: string;
  signedAt: string;
}

export interface CommitteeDecision {
  id: number;
  submissionDate: string | null;
  committeeMeetingDate: string | null;
  meetingReference: string | null;
  recommendedMethod: string | null;
  methodJustification: string | null;
  shortlistedProviders: string | null;
  shortlistJustification?: string | null;
  biddingDocumentTeam: string | null;
  biddingTeamJustification?: string | null;
  evaluationCommittee: string | null;
  evaluationJustification?: string | null;
  biddingDocumentCost: string | null;
  otherInformation: string | null;
  /** The committee's decision and conditions for each Part II row, keyed "1"–"6". */
  rowDecisions: Record<string, { decision: string | null; conditions: string | null }> | null;
  decision: string | null;
  decisionJustification: string | null;
}

/** When each approval step happened (ISO timestamps or YYYY-MM-DD dates). */
export interface StepDates {
  requested: string | null;
  headOfDepartment: string | null;
  accountingOfficer: string | null;
  submittedToCommittee: string | null;
  committeeMeeting: string | null;
  chairperson: string | null;
  secretary: string | null;
}

/** Someone who raised or moved on a request. */
export interface RequestPerson {
  name: string;
  role: string;
  department: string | null;
}

export interface RequestRecord {
  id: number;
  referenceNumber: string;
  /** Code of the budget line being spent — the fourth part of the reference. */
  supplyCode: string | null;
  category: string;
  yearType: string;
  year: number;
  /** The week of the term and the term, as FORM 5 prints them: "Week 5, Term 3". */
  weekNumber: number;
  term?: number | null;
  /** The procurement's running number: the 4th procurement is 4. */
  sequenceNumber?: number;
  budgetCategory: string;
  procurementSize: string;
  subjectOfProcurement: string;
  procurementPlanReference: string;
  locationForDelivery: string;
  /** Also the delivery date wherever one is asked for. */
  dateRequired: string;
  estimatedTotalCost: string;
  isMultiyear: boolean;
  multiyearYearOne?: string | null;
  multiyearYearTwo?: string | null;
  multiyearYearThree?: string | null;
  multiyearYearFour?: string | null;
  balanceRemainingManual?: string | null;
  voteCode?: string | null;
  voteName?: string | null;
  subProgrammeName?: string | null;
  budgetItemName?: string | null;
  /** The budget line's number, counted straight through its vote: the 13 in 2212-13. */
  budgetLineNumber?: number | null;
  /** TFORM 5's Project Code and Title, e.g. 2212-13 and "Generator". */
  projectCode?: string | null;
  projectTitle?: string | null;
  status: string;
  createdAt: string;
  items: RequestLineItem[];
  /** When it was corrected, by whom and why. */
  corrections?: { at: string; by: string | null; reason: string | null }[];
  signatures: RequestSignature[];
  decision: CommitteeDecision | null;
  stepDates?: StepDates;
  /** Who raised it, and who moved it on at each step. */
  requestedBy?: RequestPerson | null;
  stepPeople?: {
    submitted: RequestPerson | null;
    headOfDepartment: RequestPerson | null;
    accountingOfficer: RequestPerson | null;
  };
  /** The heads of department, to choose from for the confirmation on page 3. */
  departmentHeads?: { name: string; department: string | null }[];
}

const CATEGORY_NAMES: Record<string, string> = {
  supplies: "Supplies",
  works: "Works",
  non_consultancy: "Non-consultancy services",
};

/** "50.00" → "50", "2.5" → "2.5". */
const quantity = (v: string | null | undefined) =>
  v === null || v === undefined || v === "" ? "" : Number(v).toLocaleString("en-UG", { maximumFractionDigits: 2 });

/** Typed text keeps its line breaks on the form. */
const escLines = (s: string | null | undefined) => esc(s).replace(/\n/g, "<br/>");

/** A line to sign on, or to write on by hand: always ruled. */
const ruled = (label: string) =>
  `<div class="line"><span class="line-label">${label}</span><span class="line-value"></span></div>`;

/**
 * A name, title or date: printed as plain words when the system has it, with
 * no line under it. Left empty, it is ruled to be written in by hand.
 */
const filled = (label: string, value: string | null | undefined) =>
  value && value.trim()
    ? `<div class="line"><span class="line-label">${label}</span><span class="line-text">${esc(value.trim())}</span></div>`
    : ruled(label);

/** KSS/SUPLS/26/029/00246 → procurement reference KSS/SUPLS/26/029 and call-off order 246. */
export function splitReference(referenceNumber: string) {
  const parts = referenceNumber.split("/");
  if (parts.length < 2) return { procurementRef: referenceNumber, callOff: "" };
  const last = parts[parts.length - 1];
  return {
    procurementRef: parts.slice(0, -1).join("/"),
    callOff: /^\d+$/.test(last) ? String(Number(last)) : last,
  };
}

// ── TFORM 5 ──────────────────────────────────────────────────────────────

/** The titles a member of the user department signs page 3 under. */
export const DEPARTMENT_TITLES = [
  "Head of Department",
  "Assistant Head of Department",
  "Member of Department",
  "Representative",
];

/**
 * The names, titles and dates TFORM 5 fills in by itself. They are shown
 * before printing, so a wrong one can be changed; dates are YYYY-MM-DD.
 */
export type TFormFill = {
  planReference: string;
  requesterName: string;
  requesterTitle: string;
  requestedOn: string;
  hodName: string;
  hodTitle: string;
  hodOn: string;
  aoName: string;
  aoTitle: string;
  aoOn: string;
  pduName: string;
  pduTitle: string;
  pduOn: string;
  chairName: string;
  chairOn: string;
  secretaryName: string;
  secretaryOn: string;
  /** Page 4's date of the Contracts Committee meeting. */
  meetingOn: string;
};

/** Who confirms a request on page 3 at Kibuli: always the Deputy Head Teacher. */
export const CONFIRMED_BY_TITLE = "Deputy Head Teacher";

/** The title for page 3 that fits someone's role in the system. */
const departmentTitleFor = (role: string | null | undefined) =>
  role === "head_of_dept" ? "Head of Department" : role === "user_dept_member" ? "Member of Department" : "Representative";

/** Heads of department, those of the requester's department first. */
export function headsFor(request: RequestRecord) {
  const dept = request.requestedBy?.department?.trim().toLowerCase();
  const heads = request.departmentHeads ?? [];
  return [
    ...heads.filter((h) => dept && h.department?.trim().toLowerCase() === dept),
    ...heads.filter((h) => !dept || h.department?.trim().toLowerCase() !== dept),
  ];
}

/**
 * What TFORM 5 fills in when nobody changes it. Names come from whoever did
 * each step, or else from Officials. Every date is the day the request was
 * made, as the school fills the form in; Date Required, the delivery date,
 * is the only other date on it.
 */
export function tformFill(request: RequestRecord, officials: Officials): TFormFill {
  const sig = (role: string) => request.signatures.find((s) => s.role === role);
  const people = request.stepPeople;
  const day = kampalaDay(request.createdAt);

  const requester = request.requestedBy;
  const hodActed = people?.headOfDepartment?.role === "head_of_dept" ? people.headOfDepartment.name : null;
  const aoActed = people?.accountingOfficer?.role === "accounting_officer" ? people.accountingOfficer.name : null;
  // A head of department raising a request confirms it too.
  const requesterIsHead = requester?.role === "head_of_dept" ? requester.name : null;

  return {
    // The school's rule: the box carries the request's own reference number.
    planReference: request.referenceNumber,
    requesterName: sig("user_dept")?.name ?? requester?.name ?? "",
    requesterTitle: departmentTitleFor(requester?.role),
    requestedOn: day,
    // The Deputy Head Teacher confirms every request, so the deputy in Officials signs here.
    hodName:
      officials.deputy_head_teacher?.name ??
      sig("head_of_dept")?.name ??
      hodActed ??
      requesterIsHead ??
      headsFor(request)[0]?.name ??
      "",
    hodTitle: officials.deputy_head_teacher?.title || CONFIRMED_BY_TITLE,
    hodOn: day,
    aoName: sig("accounting_officer")?.name ?? aoActed ?? officials.accounting_officer?.name ?? "",
    aoTitle: officials.accounting_officer?.title || "Accounting Officer",
    aoOn: day,
    pduName: officials.pdu_head?.name ?? "",
    pduTitle: officials.pdu_head?.title || "Head, Procurement and Disposal Unit",
    pduOn: day,
    chairName: officials.committee_chairperson?.name ?? "",
    chairOn: day,
    secretaryName: officials.committee_secretary?.name ?? "",
    secretaryOn: day,
    meetingOn: day,
  };
}

/**
 * Item rows on the first items page (the form's own fifteen), and on each
 * page after it, which on a portrait sheet has room for more.
 */
const ITEMS_FIRST_PAGE = 15;
const ITEMS_LATER_PAGES = { landscape: 22, portrait: 30 };

const tformCss = (paper: "landscape" | "portrait") => `
${sheetCss(paper)}
/* Page 1 sits in the middle of its sheet, top to bottom, instead of up at the
   top. The sheet is half a millimetre short of the page so it can't spill
   onto a second one. */
.sheet.middle { display: flex; flex-direction: column; justify-content: center; height: ${
  paper === "landscape" ? "209.5mm" : "296.5mm"
}; }
body { font-family: "Times New Roman", Times, serif; font-size: 12pt; line-height: 1.25; }
table { width: 100%; border-collapse: collapse; }
.grid td, .grid th { border: 1px solid #000; padding: 1.3mm 2mm; vertical-align: top; text-align: left; font-size: 12pt; }
.grid th { font-weight: bold; text-align: center; vertical-align: middle; }
.c { text-align: center !important; }
.r { text-align: right !important; white-space: nowrap; }
.b { font-weight: bold; }
.caption { margin: 5mm 0 1.5mm; }
.tall td { height: 11mm; vertical-align: middle; }
.head { margin-bottom: 5mm; }
.head td { border: 0; padding: 0; vertical-align: middle; }
.head .badge, .head .balance { width: 38mm; }
.head .badge img { display: block; width: 32mm; height: 35.2mm; }
.head .text { text-align: center; }
.form-no { font-weight: bold; }
.regulation { font-style: italic; font-size: 11pt; }
.act { margin-top: 3mm; }
.title { font-weight: bold; font-size: 13pt; margin-top: 1.5mm; }
.ref-head { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; column-gap: 5mm; }
.week-term { justify-self: start; display: inline-flex; align-items: baseline; gap: 2mm; border: 1px solid #000; padding: 0.6mm 3mm; font-weight: normal; white-space: nowrap; }
.week-term b { min-width: 7mm; text-align: center; }
.week-term .gap { width: 4mm; }
.items td { height: 6.8mm; padding-top: 0.8mm; padding-bottom: 0.8mm; }
.items th { font-size: 11pt; }
.items .section { text-align: center; font-weight: bold; }
.items .total td { font-weight: bold; vertical-align: middle; }
.continued { font-weight: bold; margin-bottom: 3mm; }
.pto { text-align: right; font-size: 10pt; font-style: italic; margin-top: 2mm; }
.pair { display: flex; gap: 16mm; }
.pair > div { flex: 1; }
.block-title { font-weight: bold; }
.block-sub { font-style: italic; font-size: 11pt; }
.line { display: flex; align-items: flex-end; gap: 2mm; margin-top: 4.5mm; }
.line-label { white-space: nowrap; }
.line-value { flex: 0 0 60mm; border-bottom: 1px solid #000; min-height: 6.5mm; padding: 0 1mm 0.5mm; }
.line-text { flex: 1; padding: 0 1mm; }
.funds-note { font-style: italic; margin: 7mm 0 1.5mm; }
.part2-title { text-align: center; font-weight: bold; font-size: 13pt; margin: 0 18mm 5mm; }
.part2 .high td { height: 22mm; }
.part2 .low td { height: 10mm; }
.declaration { margin-top: 7mm; }
.declaration-title { font-weight: bold; }
`;

/**
 * PPDA FORM 5 as the school prints it: 12 point, one part per page, the badge
 * on the first page only; a macro procurement on landscape A4, a micro one on
 * portrait. `fill` holds the names, titles and dates, as checked before
 * printing.
 */
export function printTForm(request: RequestRecord, fill: TFormFill) {
  const isMacro = request.procurementSize === "macro";
  const paper = isMacro ? "landscape" : "portrait";
  const css = tformCss(paper);
  const total = request.items.reduce((s, it) => s + Number(it.totalCost || 0), 0);

  // The procurement's own number: the 18th procurement is 18.
  const lastPart = request.referenceNumber.split("/").pop() ?? "";
  const sequence = request.sequenceNumber ?? (/^\d+$/.test(lastPart) ? Number(lastPart) : lastPart);

  // ── Page 1: Part I heading, reference, budget, multiyear
  const yearCells = request.isMultiyear
    ? [request.multiyearYearOne, request.multiyearYearTwo, request.multiyearYearThree, request.multiyearYearFour].map(money)
    : ["✓", "", "", ""]; // a single-year procurement needs its resources in year one
  const page1 = `
<div class="sheet middle">
  <table class="head"><tr>
    <td class="badge"><img src="${KSS_BADGE}" alt="" /></td>
    <td class="text">
      <div class="form-no">FORM 5</div>
      <div class="regulation">Regulation 3(1), 13(3), 15(3), 17(3) 24(2), 53(6), 54(5)</div>
      <div class="act">THE PUBLIC PROCUREMENT AND DISPOSAL OF PUBLIC ASSETS ACT, 2003</div>
      <div class="title">REQUEST FOR APPROVAL OF PROCUREMENT</div>
      <div class="title">PART I: REQUEST BY USER DEPARTMENT FOR APPROVAL OF PROCUREMENT</div>
    </td>
    <td class="balance"></td>
  </tr></table>

  <table class="grid">
    <tr><th colspan="4"><div class="ref-head">
      <span></span>
      <span>Procurement Reference Number</span>
      <span class="week-term">Week <b>${esc(request.weekNumber ?? "")}</b><span class="gap"></span>Term <b>${esc(
        request.term ?? ""
      )}</b></span>
    </div></th></tr>
    <tr>
      <td class="c" style="width:30%">Code of Procuring and Disposing Entity</td>
      <td class="c" style="width:30%">Supplies/Works/Non-consultancy services</td>
      <td class="c" style="width:20%">Financial Year</td>
      <td class="c" style="width:20%">Sequence Number</td>
    </tr>
    <tr class="tall">
      <td class="c">Kibuli Secondary School</td>
      <td class="c">${esc(CATEGORY_NAMES[request.category] ?? request.category)}</td>
      <td class="c">${esc(String(request.year))}</td>
      <td class="c">${esc(sequence)}</td>
    </tr>
  </table>

  <div class="caption">Category of procurement and budget</div>
  <table class="grid">
    <tr>
      <td class="c" style="width:25%">Recurrent Budget</td>
      <td class="c" style="width:25%">Development Budget</td>
      <td class="c" style="width:25%">Project Code</td>
      <td class="c" style="width:25%">Project Title</td>
    </tr>
    <tr class="tall">
      <td class="c">${request.budgetCategory === "recurrent" ? "✓" : ""}</td>
      <td class="c">${request.budgetCategory === "development" ? "✓" : ""}</td>
      <td class="c">${esc(request.projectCode ?? request.voteCode)}</td>
      <td>${esc(request.projectTitle ?? request.budgetItemName)}</td>
    </tr>
  </table>

  <div class="caption">Is procurement going to result into multiyear contracting?</div>
  <table class="grid">
    <tr>
      <td class="c" style="width:25%">Required Resources (UGX Bn) Year One</td>
      <td class="c" style="width:25%">Required Resources (UGX Bn) Year Two</td>
      <td class="c" style="width:25%">Required Resources (UGX Bn) Year Three</td>
      <td class="c" style="width:25%">Required Resources (UGX Bn) Year Four</td>
    </tr>
    <tr class="tall">${yearCells.map((v) => `<td class="c">${esc(v)}</td>`).join("")}</tr>
  </table>
</div>`;

  // ── Page 2 (and more if the items don't fit): particulars and items
  const itemHeader = `<tr>
      <th style="width:6%">Item No.</th>
      <th style="width:42%">Description<br/><em>(Attach specifications, terms of reference or scope of works)</em></th>
      <th style="width:10%">Quantity</th>
      <th style="width:12%">Unit of Measure</th>
      <th style="width:15%">Estimated Unit Cost</th>
      <th style="width:15%">Estimated Cost</th>
    </tr>`;
  const particulars = `<table class="grid">
    <tr><td colspan="2" class="b">Particulars of Procurement</td></tr>
    <tr><td style="width:35%">Subject of Procurement</td><td>${esc(request.subjectOfProcurement)}</td></tr>
    <tr><td>Procurement Plan Reference</td><td>${esc(fill.planReference)}</td></tr>
    <tr><td>Location for Delivery</td><td>${esc(request.locationForDelivery)}</td></tr>
    <tr><td>Date Required</td><td>${esc(dayFirst(request.dateRequired))}</td></tr>
  </table>`;
  const page2 = tableSheets({
    css,
    paper,
    items: request.items,
    row: (it, i) =>
      `<tr><td class="c">${i + 1}</td><td>${esc(it.description)}</td><td class="c">${esc(
        quantity(it.quantity)
      )}</td><td class="c">${esc(it.unitOfMeasure)}</td><td class="r">${money(it.estimatedUnitCost)}</td><td class="r">${money(
        it.totalCost
      )}</td></tr>`,
    // The first page keeps the form's fifteen ruled rows even when fewer are used.
    blankRow: "<tr><td></td><td></td><td></td><td></td><td></td><td></td></tr>",
    most: { first: ITEMS_FIRST_PAGE, rest: ITEMS_LATER_PAGES[paper] },
    sheet: (rows, { first, last }) => `
<div class="sheet">
  ${first ? particulars : `<div class="continued">Details Relating to the Procurement (continued)</div>`}
  <table class="grid items" style="margin-top:${first ? "4mm" : "0"}">
    ${first ? `<tr><td colspan="6" class="section">Details Relating to the Procurement</td></tr>` : ""}
    ${itemHeader}
    ${rows}
    ${
      last
        ? `<tr class="total"><td colspan="4"></td><td>Estimated Total Cost</td><td class="r">${money(total)}</td></tr>`
        : ""
    }
  </table>
  ${last ? "" : `<div class="pto">P.T.O.</div>`}
</div>`,
  });

  // ── Page 3: requester, head of department, funds, Accounting Officer
  const signer = (name: string, title: string, date: string) =>
    `${ruled("Signature:")}${filled("Name:", name)}${filled("Title:", title)}${filled("Date:", dayFirst(date))}`;
  const page3 = `
<div class="sheet">
  <div class="pair">
    <div>
      <div class="block-title">(1)&nbsp; Request for Procurement</div>
      <div class="block-sub">(Member of user department)</div>
      ${signer(fill.requesterName, fill.requesterTitle, fill.requestedOn)}
    </div>
    <div>
      <div class="block-title">(2)&nbsp; Confirmation of Request</div>
      <div class="block-sub">(Head of user department)</div>
      ${signer(fill.hodName, fill.hodTitle, fill.hodOn)}
    </div>
  </div>

  <div class="funds-note">Availability of funds to be confirmed prior to approval by Accounting Officer/ Head teacher:</div>
  <table class="grid">
    <tr>
      <th style="width:15%">Vote/head No</th>
      <th style="width:25%">Programme</th>
      <th style="width:25%">Sub-programme</th>
      <th style="width:20%">Item</th>
      <th style="width:15%">Balance remaining</th>
    </tr>
    <tr class="tall">
      <td></td>
      <td>${esc(request.voteName)}</td>
      <td>${esc(request.projectTitle ?? request.subProgrammeName)}</td>
      <td class="c">${esc(request.budgetLineNumber)}</td>
      <td class="r">${money(request.balanceRemainingManual)}</td>
    </tr>
  </table>

  <div style="margin-top:7mm">
    <div class="block-title">(3)&nbsp; Confirmation of Funding and Approval to Procure</div>
    <div class="block-sub">(Accounting Officer)</div>
    <div class="pair">
      <div>
        ${ruled("Signature:")}
        ${filled("Title:", fill.aoTitle)}
      </div>
      <div>
        ${filled("Name:", fill.aoName)}
        ${filled("Date:", dayFirst(fill.aoOn))}
      </div>
    </div>
  </div>
</div>`;

  // ── Pages 4 and 5 (macro only): Part II and the declarations
  let macroPages = "";
  if (isMacro) {
    const part2 = request.decision;
    const meetingDateRef = [dayFirst(fill.meetingOn), part2?.meetingReference].filter(Boolean).join(" / ");
    const rows = [
      {
        key: "1",
        size: "high",
        label: "Recommended method of procurement and justification",
        answer: part2?.recommendedMethod,
        justification: part2?.methodJustification || DEFAULT_JUSTIFICATION,
      },
      {
        key: "2",
        size: "high",
        label: "Names of shortlisted provider (s) and justification for selection",
        answer: part2?.shortlistedProviders,
        justification: part2?.shortlistJustification,
      },
      {
        key: "3",
        size: "high",
        label: "Bidding document. Persons involved in preparation of proposal document <em>(Names and positions)</em>",
        answer: part2?.biddingDocumentTeam,
        justification: part2?.biddingTeamJustification,
      },
      {
        key: "4",
        size: "high",
        label:
          "Names of persons recommended to constitute the Evaluation Committee and the justification <em>(Names and positions)</em>",
        answer: part2?.evaluationCommittee,
        justification: part2?.evaluationJustification,
      },
      {
        key: "5",
        size: "low",
        label: "Cost of the bidding document, if any",
        answer: part2?.biddingDocumentCost ? `UGX ${money(part2.biddingDocumentCost)}` : "",
        justification: "",
      },
      { key: "6", size: "low", label: "Any other information", answer: part2?.otherInformation, justification: "" },
    ]
      .map((r) => {
        const decided = part2?.rowDecisions?.[r.key];
        // The submission's justification, then any conditions the committee set.
        const lastColumn = [r.justification, decided?.conditions].filter(Boolean).map(escLines).join("<br/>");
        return `<tr class="${r.size}">
      <td>${r.key}.</td>
      <td>${r.label}</td>
      <td>${escLines(r.answer)}</td>
      <td>${escLines(decided?.decision)}</td>
      <td>${lastColumn}</td>
    </tr>`;
      })
      .join("");

    macroPages = `
<div class="sheet">
  <div class="part2-title">PART II: REQUEST BY PROCUREMENT AND DISPOSAL UNIT TO CONTRACTS COMMITTEE FOR APPROVAL OF PROCUREMENT METHOD</div>
  <table class="grid part2">
    <tr>
      <th style="width:6%"></th>
      <th colspan="2" style="width:54%">Submission by the Procurement<br/>and Disposal Unit</th>
      <th style="width:18%">Decision of the<br/>Contracts Committee</th>
      <th style="width:22%">Conditions/<br/>Justification for Decision</th>
    </tr>
    <tr>
      <td></td>
      <td class="b" style="width:33%">Date of Submission to Contracts Committee:</td>
      <td style="width:21%">${esc(dayFirst(fill.pduOn))}</td>
      <td class="b">Date/Reference of Contracts Committee Meeting:${
        meetingDateRef ? ` <span style="font-weight:normal">${esc(meetingDateRef)}</span>` : ""
      }</td>
      <td></td>
    </tr>
    ${rows}
  </table>
</div>

<div class="sheet">
  <div><em><strong>Documents attached:</strong></em></div>
  <div style="margin:1.5mm 0 0 8mm">Bidding Document</div>

  <div class="declaration">
    <div class="declaration-title">Declaration by Procurement and Disposal Unit</div>
    <div>The information contained in this form and the attached documents is complete, true and accurate and in accordance with the Public Procurement and Disposal of Public Assets Act, 2003.</div>
    <div class="pair">
      <div>${ruled("Signature:")}${filled("Position:", fill.pduTitle)}</div>
      <div>${filled("Name:", fill.pduName)}${filled("Date:", dayFirst(fill.pduOn))}</div>
    </div>
  </div>

  <div class="declaration">
    <div class="declaration-title">Declaration by Contracts Committee</div>
    <div>The information contained in this form is a true and accurate record of the decision of the Contracts Committee meeting held on the above date.</div>
    <div class="pair">
      <div>${ruled("Signature:")}<div class="line"><span class="line-label">Position:</span><span class="b">&nbsp;Chairperson Contracts Committee</span></div></div>
      <div>${filled("Name:", fill.chairName)}${filled("Date:", dayFirst(fill.chairOn))}</div>
    </div>
    <div class="pair" style="margin-top:4mm">
      <div>${ruled("Signature:")}<div class="line"><span class="line-label">Position:</span><span class="b">&nbsp;Secretary Contracts Committee</span></div></div>
      <div>${filled("Name:", fill.secretaryName)}${filled("Date:", dayFirst(fill.secretaryOn))}</div>
    </div>
  </div>
</div>`;
  }

  openPrint(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>FORM 5 — ${esc(request.referenceNumber)}</title>
<style>${css}</style></head><body>${page1}${page2}${page3}${macroPages}</body></html>`);
}

// ── Call-Off Order with its List of Supplies and Price Schedule ───────────
//
// One document: the call-off order is its first page, and the school's "List
// of Supplies and Price Schedule" follows it. The badge goes on the first
// page only.

const SCHEDULE_FIRST_PAGE = 25;
const SCHEDULE_LATER_PAGES = 30;

const SCHEDULE_CSS = `
${sheetCss("portrait", "14mm 14mm 10mm 24mm")}
body { font-family: "Times New Roman", Times, serif; font-size: 13px; }
h1 { text-align: center; font-size: 21px; margin: 0 0 16px; }
.refs { text-align: center; font-weight: bold; font-size: 14px; line-height: 2; }
.refs .v { font-family: Arial, Helvetica, sans-serif; margin-left: 36px; }
.continued { font-weight: bold; font-size: 14px; margin-bottom: 8px; }
table { width: 100%; border-collapse: collapse; }
.items { margin-top: 16px; }
.items th, .items td { border: 1.5px solid #000; padding: 2px 6px; height: 22px; }
.items th { background: #d9d9d9; text-align: left; vertical-align: top; font-size: 14px; height: 50px; }
.items td { font-family: Arial, Helvetica, sans-serif; font-size: 12px; }
.c { text-align: center; }
.r { text-align: right; white-space: nowrap; }
.totals { width: 44%; margin-left: auto; margin-top: -1.5px; }
.totals td { border: 1.5px solid #000; padding: 4px 6px; height: 30px; }
.totals .label { text-align: right; font-weight: bold; font-size: 14px; width: 68%; }
.totals .v { font-family: Arial, Helvetica, sans-serif; }
.pto { text-align: right; font-size: 11px; font-style: italic; margin-top: 6px; }
`;

/** The call-off order's page, set apart from the schedule's styles. */
const CALLOFF_CSS = `
.sheet.calloff { padding: 22mm 20mm 14mm 26mm; font-size: 13pt; line-height: 1.35; }
.calloff h1 { text-align: center; font-size: 21pt; margin: 0; }
.calloff h2 { text-align: center; font-size: 14pt; margin: 1mm 0 10mm; }
.calloff .fields { width: auto; border-collapse: collapse; margin-bottom: 4mm; }
.calloff .fields td { padding: 1.4mm 0; vertical-align: top; }
.calloff .fields td:first-child { font-weight: bold; width: 74mm; }
.calloff .fields td:last-child { font-weight: bold; }
.calloff p { margin: 0 0 3.5mm; text-align: justify; }
.calloff .auth { width: 100%; border-collapse: collapse; margin-top: 4mm; }
.calloff .auth td, .calloff .auth th { border: 1px solid #000; padding: 2.5mm 3mm; text-align: left; }
.calloff .auth th { font-weight: bold; }
.calloff .auth td:first-child { width: 30mm; }
.calloff .auth .sign td { height: 11mm; }
`;

/**
 * The school's "List of Supplies and Price Schedule", as the sheets that
 * follow the call-off order. Its references split the request's number the
 * way the school's own do: KSS/SUPLS/26/029 as the procurement reference, and
 * the running number (246) as the call-off order.
 */
function scheduleSheets(request: RequestRecord) {
  const { procurementRef, callOff } = splitReference(request.referenceNumber);
  const total = request.items.reduce((s, it) => s + Number(it.totalCost || 0), 0);

  return tableSheets({
    css: SCHEDULE_CSS,
    paper: "portrait",
    items: request.items,
    row: (it, i) =>
      `<tr><td class="c">${i + 1}</td><td>${esc(it.description)}</td><td class="c">${esc(
        quantity(it.quantity)
      )}</td><td class="c">${esc(it.unitOfMeasure)}</td><td class="r">${money(it.estimatedUnitCost)}</td><td class="r">${money(
        it.totalCost
      )}</td></tr>`,
    blankRow: "<tr><td></td><td></td><td></td><td></td><td></td><td></td></tr>",
    most: { first: SCHEDULE_FIRST_PAGE, rest: SCHEDULE_LATER_PAGES },
    sheet: (rows, { first, last }) => `
<div class="sheet">
  ${
    first
      ? `<h1>List of Supplies and Price Schedule</h1>
  <div class="refs">
    <div>Procurement Reference No:<span class="v">${esc(procurementRef)}</span></div>
    <div>Call-Off Order Reference No:<span class="v">${esc(callOff)}</span></div>
  </div>`
      : `<div class="continued">List of Supplies and Price Schedule (continued)</div>`
  }
  <table class="items">
    <thead><tr>
      <th style="width:6%">Item No</th><th style="width:27%">Description of Supplies</th><th style="width:10%">Quantity</th>
      <th style="width:13%">Unit of Measure</th><th style="width:30%">Unit Price</th><th style="width:14%">Total Price</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  ${
    last
      ? `<table class="totals">
    <tr><td class="label">Other additional costs</td><td></td></tr>
    <tr><td class="label">Subtotal</td><td></td></tr>
    <tr><td class="label">VAT @ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; %</td><td></td></tr>
    <tr><td class="label">Total Price</td><td class="r v">${money(total)}</td></tr>
  </table>`
      : `<div class="pto">P.T.O.</div>`
  }
</div>`,
  });
}

/** "Four Million Seventy-Five Thousand Shillings Only" → "Four million seventy five thousand shillings only". */
function sentenceWords(amount: number) {
  const words = shillingsInWords(amount).replace(/-/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** What the call-off order fills in, checked before printing. The date is YYYY-MM-DD. */
export type CallOffFill = {
  provider: string;
  date: string;
  authorisedName: string;
  authorisedPosition: string;
};

/** The call-off order's starting values: the LPO's supplier and date, and the Accounting Officer. */
export function callOffFill(
  officials: Officials,
  lpo: { supplierName: string | null; issueDate: string | null } | null
): CallOffFill {
  return {
    provider: lpo?.supplierName ?? "",
    date: kampalaDay(lpo?.issueDate) || kampalaDay(new Date().toISOString()),
    authorisedName: officials.accounting_officer?.name ?? "",
    authorisedPosition: officials.accounting_officer?.title || "Accounting Officer",
  };
}

/**
 * The Call-Off Order under a framework contract, with its List of Supplies
 * and Price Schedule after it, printed as the one document they are.
 */
export function printCallOffOrder(request: RequestRecord, fill: CallOffFill) {
  const { procurementRef, callOff } = splitReference(request.referenceNumber);
  const total = request.items.reduce((s, it) => s + Number(it.totalCost || 0), 0);

  const callOffPage = `
<div class="sheet calloff">
  ${cornerBadge}
  <h1>Call-Off Order</h1>
  <h2>Under a Framework Contract</h2>
  <table class="fields">
    <tr><td>Procurement Reference No:</td><td>${esc(procurementRef)}</td></tr>
    <tr><td>Call-Off Order Reference No:</td><td>${esc(callOff)}</td></tr>
    <tr><td>Procuring and Disposing Entity:</td><td>KIBULI SECONDARY SCHOOL</td></tr>
    <tr><td>Provider:</td><td>${esc(fill.provider.toUpperCase())}</td></tr>
    <tr><td>Date of Call-Off Order:</td><td>${esc(dayFirst(fill.date))}</td></tr>
  </table>
  <p>The Procuring and Disposing Entity indicated above issues this call-off order under the framework contract referenced above.</p>
  <p>This call-off order is subject to the terms and conditions of the framework contract referenced above. In the event of a conflict, between this call-off order and the contract, the contract shall prevail.</p>
  <p>Please proceed with delivery of the Supplies <strong>OR</strong> Services detailed on the attached List of Supplies and Price Schedule, in accordance with the response times specified in the contract.</p>
  <p>The total value of this call-off order is <strong>(${money(total)})</strong> ${esc(sentenceWords(total))}.</p>
  <p>Please confirm your receipt of this call-off order and that you are proceeding with delivery of the Supplies, in accordance with the terms and conditions of the contract.</p>
  <table class="auth">
    <tr><th colspan="2">Authorised by:</th></tr>
    <tr class="sign"><td>Signature:</td><td></td></tr>
    <tr><td>Name:</td><td>${esc(fill.authorisedName.toUpperCase())}</td></tr>
    <tr><td>Position:</td><td>${esc(fill.authorisedPosition)}</td></tr>
  </table>
</div>`;

  openPrint(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Call-Off Order — ${esc(request.referenceNumber)}</title>
<style>${SCHEDULE_CSS}${CALLOFF_CSS}</style></head><body>${callOffPage}${scheduleSheets(request)}</body></html>`);
}
