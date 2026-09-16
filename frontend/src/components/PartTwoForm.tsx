/**
 * PPDA FORM 5 Part II — the Procurement and Disposal Unit's request to the
 * Contracts Committee — laid out like the paper form: six rows, the PDU's
 * submission on the left and, once the committee sits, its decision and
 * conditions for each row.
 */

export interface PartTwoSubmission {
  recommendedMethod: string;
  methodJustification: string;
  shortlistedProviders: string;
  biddingDocumentTeam: string;
  evaluationCommittee: string;
  biddingDocumentCost: string;
  otherInformation: string;
}

export interface RowDecision {
  decision: string;
  conditions: string;
}

export type RowDecisions = Record<string, RowDecision>;

export const EMPTY_SUBMISSION: PartTwoSubmission = {
  recommendedMethod: "",
  methodJustification: "",
  shortlistedProviders: "",
  biddingDocumentTeam: "",
  evaluationCommittee: "",
  biddingDocumentCost: "",
  otherInformation: "",
};

const ROWS = [
  { key: "1", label: "Recommended method of procurement and justification" },
  { key: "2", label: "Names of shortlisted provider(s) and justification for selection" },
  { key: "3", label: "Bidding document. Persons involved in preparation of proposal document", hint: "names and positions" },
  { key: "4", label: "Names of persons recommended to constitute the Evaluation Committee and the justification", hint: "names and positions" },
  { key: "5", label: "Cost of the bidding document, if any" },
  { key: "6", label: "Any other information" },
];

// Worded as in the school's procurement plan, plus the other PPDA methods.
const PPDA_METHODS = [
  "Open Domestic Bidding",
  "Open International Bidding",
  "Restricted Domestic Bidding",
  "Restricted International Bidding (RIB)",
  "Quotations Method",
  "Request for Proposals",
  "Direct Procurement",
  "Micro Procurement",
  "Force Account",
];

const ROW_DECISIONS = ["Approved", "Approved with conditions", "Not approved", "Deferred"];

/** Input-ready strings from a stored Part II record. */
export function submissionFrom(
  d: Partial<Record<keyof PartTwoSubmission, string | null>> | null | undefined
): PartTwoSubmission {
  return {
    recommendedMethod: d?.recommendedMethod ?? "",
    methodJustification: d?.methodJustification ?? "",
    shortlistedProviders: d?.shortlistedProviders ?? "",
    biddingDocumentTeam: d?.biddingDocumentTeam ?? "",
    evaluationCommittee: d?.evaluationCommittee ?? "",
    biddingDocumentCost: d?.biddingDocumentCost ? String(Number(d.biddingDocumentCost)) : "",
    otherInformation: d?.otherInformation ?? "",
  };
}

/** Input-ready rows from the stored { "1": { decision, conditions } } map. */
export function rowDecisionsFrom(raw: unknown): RowDecisions {
  const rows: RowDecisions = {};
  if (!raw || typeof raw !== "object") return rows;
  for (const [key, value] of Object.entries(raw as Record<string, Partial<Record<keyof RowDecision, string | null>>>)) {
    rows[key] = { decision: value?.decision ?? "", conditions: value?.conditions ?? "" };
  }
  return rows;
}

interface Props {
  submission: PartTwoSubmission;
  /** Leave out to show the submission read-only. */
  onSubmissionChange?: (patch: Partial<PartTwoSubmission>) => void;
  /** Show the Contracts Committee's decision and conditions columns. */
  showCommittee?: boolean;
  rowDecisions?: RowDecisions;
  /** Leave out to show the committee's columns read-only. */
  onRowDecisionChange?: (row: string, patch: Partial<RowDecision>) => void;
}

const emptyMark = <span className="text-gray-400">—</span>;

export default function PartTwoTable({
  submission,
  onSubmissionChange,
  showCommittee = false,
  rowDecisions = {},
  onRowDecisionChange,
}: Props) {
  const set = (patch: Partial<PartTwoSubmission>) => onSubmissionChange?.(patch);

  function submissionView(key: string) {
    const text: Record<string, string> = {
      "1": [submission.recommendedMethod, submission.methodJustification].filter(Boolean).join("\n"),
      "2": submission.shortlistedProviders,
      "3": submission.biddingDocumentTeam,
      "4": submission.evaluationCommittee,
      "5": submission.biddingDocumentCost
        ? `UGX ${Number(submission.biddingDocumentCost).toLocaleString("en-UG")}`
        : "",
      "6": submission.otherInformation,
    };
    return <div className="whitespace-pre-line text-gray-800">{text[key] || emptyMark}</div>;
  }

  function submissionInput(key: string) {
    const area = (field: keyof PartTwoSubmission, placeholder: string, rows = 3) => (
      <textarea
        value={submission[field]}
        onChange={(e) => set({ [field]: e.target.value })}
        className="input text-xs"
        rows={rows}
        placeholder={placeholder}
      />
    );
    switch (key) {
      case "1":
        return (
          <div className="space-y-1">
            <input
              list="ppda-methods"
              value={submission.recommendedMethod}
              onChange={(e) => set({ recommendedMethod: e.target.value })}
              className="input text-xs"
              placeholder="Method — e.g. Open Domestic Bidding"
            />
            {area("methodJustification", "Justification", 2)}
          </div>
        );
      case "2":
        return area("shortlistedProviders", "One provider per line, with why each was chosen");
      case "3":
        return area("biddingDocumentTeam", "Name — position, one per line");
      case "4":
        return area("evaluationCommittee", "Name — position, one per line, then the justification");
      case "5":
        return (
          <input
            type="number"
            min="0"
            step="1"
            value={submission.biddingDocumentCost}
            onChange={(e) => set({ biddingDocumentCost: e.target.value })}
            className="input text-xs"
            placeholder="UGX — leave blank if free"
          />
        );
      default:
        return area("otherInformation", "Anything else the committee should know", 2);
    }
  }

  function committeeCells(key: string) {
    const r = rowDecisions[key] ?? { decision: "", conditions: "" };
    if (!onRowDecisionChange) {
      return (
        <>
          <td className="px-2 py-2 align-top whitespace-pre-line text-gray-800">{r.decision || emptyMark}</td>
          <td className="px-2 py-2 align-top whitespace-pre-line text-gray-800">{r.conditions || emptyMark}</td>
        </>
      );
    }
    return (
      <>
        <td className="px-2 py-2 align-top">
          <input
            list="committee-row-decisions"
            value={r.decision}
            onChange={(e) => onRowDecisionChange(key, { decision: e.target.value })}
            className="input text-xs"
            placeholder="Decision"
          />
        </td>
        <td className="px-2 py-2 align-top">
          <textarea
            value={r.conditions}
            onChange={(e) => onRowDecisionChange(key, { conditions: e.target.value })}
            className="input text-xs"
            rows={2}
            placeholder="Conditions / justification"
          />
        </td>
      </>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border border-gray-200">
        <thead className="bg-gray-50/80 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-2 py-2 text-left w-8">#</th>
            <th className="px-2 py-2 text-left">Submission by the Procurement and Disposal Unit</th>
            {showCommittee && (
              <>
                <th className="px-2 py-2 text-left w-1/5">Decision of the Contracts Committee</th>
                <th className="px-2 py-2 text-left w-1/4">Conditions / justification for decision</th>
              </>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {ROWS.map((row) => (
            <tr key={row.key}>
              <td className="px-2 py-2 align-top text-xs text-gray-400">{row.key}.</td>
              <td className="px-2 py-2 align-top">
                <div className="text-xs font-medium text-gray-600 mb-1">
                  {row.label}
                  {row.hint && <em className="font-normal"> ({row.hint})</em>}
                </div>
                {onSubmissionChange ? submissionInput(row.key) : submissionView(row.key)}
              </td>
              {showCommittee && committeeCells(row.key)}
            </tr>
          ))}
        </tbody>
      </table>
      <datalist id="ppda-methods">
        {PPDA_METHODS.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>
      <datalist id="committee-row-decisions">
        {ROW_DECISIONS.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>
    </div>
  );
}
