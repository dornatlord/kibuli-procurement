import { forgetName, nameChoices, namesIn } from "../officials";
import type { Officials } from "../officials";
import { planOptions } from "../planLines";
import type { PlanLines } from "../planLines";
import { CONFIRMED_BY_TITLE, DEPARTMENT_TITLES, headsFor } from "./requestForms";
import type { RequestRecord } from "./requestForms";
import type { CheckSection } from "../../components/PrintCheck";

/** What the form's boxes need to know about the request they belong to. */
export type SectionsRequest = Pick<
  RequestRecord,
  "referenceNumber" | "procurementPlanReference" | "procurementSize" | "requestedBy" | "stepPeople" | "departmentHeads"
>;

/** The boxes that hold page 3's three signatories: the ones every request needs when it's raised. */
export const PAGE_THREE_KEYS = ["requesterName", "requesterTitle", "requestedOn", "hodName", "hodTitle", "hodOn", "aoName", "aoTitle", "aoOn"] as const;

/** What the check before printing TFORM 5 asks about, page by page, with the choices for each. */
export function tformSections(
  request: SectionsRequest,
  officials: Officials,
  plan: PlanLines | null
): CheckSection[] {
  const people = [request.requestedBy, request.stepPeople?.submitted]
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map((p) => p.name);
  const heads = headsFor(request).map((h) => ({ value: h.name, hint: h.department ?? undefined }));
  const sections: CheckSection[] = [
    {
      title: "Page 2 — procurement plan",
      fields: [
        {
          key: "planReference",
          label: "Procurement plan reference",
          // The request's own reference number first, then the plan line it was raised against.
          options: [
            { value: request.referenceNumber, hint: "This request's reference number" },
            ...(request.procurementPlanReference
              ? [{ value: request.procurementPlanReference, hint: "The plan line chosen on the request" }]
              : []),
            ...planOptions(plan?.lines ?? []),
          ],
          wide: true,
        },
      ],
    },
    {
      title: "Page 3 — (1) request for procurement",
      fields: [
        // The names kept under the title chosen beside it come first; an × takes one off the list.
        {
          key: "requesterName",
          label: "Name",
          options: (v) => nameChoices(officials, v.requesterTitle, ...people),
          onRemove: (name, v) => forgetName(v.requesterTitle, name),
        },
        { key: "requesterTitle", label: "Title", options: DEPARTMENT_TITLES },
        { key: "requestedOn", label: "Date", type: "date" },
      ],
    },
    {
      title: "Page 3 — (2) confirmation of request",
      fields: [
        // The Deputy Head Teacher confirms requests: every deputy is offered, then anyone kept under the title chosen.
        {
          key: "hodName",
          label: "Name",
          options: (v) => nameChoices(officials, v.hodTitle, ...namesIn(officials, "deputy_head_teacher"), ...heads),
          onRemove: (name, v) => forgetName(v.hodTitle, name),
        },
        {
          key: "hodTitle",
          label: "Title",
          // The deputy's title as written in Officials, however it's spelt there.
          options: [officials.deputy_head_teacher?.title || CONFIRMED_BY_TITLE, ...DEPARTMENT_TITLES],
        },
        { key: "hodOn", label: "Date", type: "date" },
      ],
    },
    {
      title: "Page 3 — (3) Accounting Officer",
      fields: [
        {
          key: "aoName",
          label: "Name",
          options: (v) => nameChoices(officials, v.aoTitle, ...namesIn(officials, "accounting_officer", "head_teacher")),
          onRemove: (name, v) => forgetName(v.aoTitle, name),
        },
        {
          key: "aoTitle",
          label: "Title",
          options: [officials.accounting_officer?.title ?? "", "Accounting Officer", "Head Teacher"],
        },
        { key: "aoOn", label: "Date", type: "date" },
      ],
    },
  ];
  if (request.procurementSize === "macro") {
    sections.push(
      {
        title: "Page 5 — Procurement and Disposal Unit",
        fields: [
          {
            key: "pduName",
            label: "Name",
            options: (v) => nameChoices(officials, v.pduTitle, ...namesIn(officials, "pdu_head")),
            onRemove: (name, v) => forgetName(v.pduTitle, name),
          },
          { key: "pduTitle", label: "Position", options: [officials.pdu_head?.title ?? ""] },
          { key: "pduOn", label: "Date (also the date of submission on page 4)", type: "date" },
        ],
      },
      {
        title: "Page 4 — Contracts Committee meeting",
        fields: [{ key: "meetingOn", label: "Date of the meeting", type: "date" }],
      },
      {
        title: "Page 5 — Contracts Committee chairperson",
        fields: [
          { key: "chairName", label: "Name", options: namesIn(officials, "committee_chairperson") },
          { key: "chairOn", label: "Date", type: "date" },
        ],
      },
      {
        title: "Page 5 — Contracts Committee secretary",
        fields: [
          { key: "secretaryName", label: "Name", options: namesIn(officials, "committee_secretary") },
          { key: "secretaryOn", label: "Date", type: "date" },
        ],
      }
    );
  }
  return sections;
}

