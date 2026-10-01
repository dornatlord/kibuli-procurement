import type { ReactNode } from "react";
import Combobox from "./Combobox";

/**
 * PPDA FORM 5 Part II — the Procurement and Disposal Unit's request to the
 * Contracts Committee — laid out like the paper form: six rows, the PDU's
 * submission on the left and, once the committee sits, its decision and
 * conditions for each row. Rows 1 to 4 ask for the answer (the method, or
 * the names) and its justification separately, as the printed form has a
 * column for each.
 */

export interface PartTwoSubmission {
  recommendedMethod: string;
  methodJustification: string;
  shortlistedProviders: string;
  shortlistJustification: string;
  biddingDocumentTeam: string;
  biddingTeamJustification: string;
  evaluationCommittee: string;
  evaluationJustification: string;
  biddingDocumentCost: string;
  otherInformation: string;
}

export interface RowDecision {
  decision: string;
  conditions: string;
}

export type RowDecisions = Record<string, RowDecision>;

/**
 * Common grounds for the recommended method, from the PPDA Act and regulations
 * and PPDA's guidance on preference and reservation schemes. The first prints
 * when none is given.
 */
export const METHOD_JUSTIFICATIONS = [
  "Support of local companies: reserved for, or giving preference to, national and local providers",
  "Support of local industries / farms",
  "The estimated value falls within the threshold for this method",
  "Buy Uganda Build Uganda: the goods are made or assembled in Uganda",
  "Urgent need: the time open bidding takes would disrupt the school",
  "Only one provider can supply the item (sole source or proprietary item)",
  "Compatibility with the school's existing equipment (standardisation)",
  "Few qualified providers exist in the market for this requirement",
  "The providers are prequalified on the school's shortlist",
  "Additional quantities under an existing contract, on the same terms",
  "Call-off under an existing framework contract",
  "Best value for money for the amount involved",
  "Specialised expertise or technical capacity is required",
  "Promotes open, fair competition and transparency",
  "The requirement is sensitive for security or confidentiality reasons",
];

export const DEFAULT_JUSTIFICATION = METHOD_JUSTIFICATIONS[0];

/** Why the shortlisted providers were chosen (row 2). */
const SELECTION_JUSTIFICATIONS = [
  "Good previous performance",
  "Prequalified on the school's list of providers",
  "Support of local industries / farms",
  "Competitive prices in recent quotations",
  "Able to deliver on time; close to the school",
  "Holds the licences and certificates the work needs",
  "The only provider of the item",
  "Framework contract already in place with the provider",
];

/** Why these people prepare the bidding document (row 3). */
const TEAM_JUSTIFICATIONS = [
  "Technical",
  "Technical knowledge of the requirement",
  "The user department knows the specifications",
  "Experience in preparing bidding documents",
  "Procurement and Disposal Unit staff",
];

/** Why these people make up the Evaluation Committee (row 4). */
const EVALUATION_JUSTIFICATIONS = [
  "Technical",
  "Technical knowledge of the requirement",
  "Experience in evaluating bids",
  "Drawn from the user department, finance and procurement",
  "No conflict of interest with the bidders",
];

export const EMPTY_SUBMISSION: PartTwoSubmission = {
  recommendedMethod: "",
  methodJustification: "",
  shortlistedProviders: "",
  shortlistJustification: "",
  biddingDocumentTeam: "",
  biddingTeamJustification: "",
  evaluationCommittee: "",
  evaluationJustification: "",
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
  "Restricted Domestic Bidding (RDB)",
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
    shortlistJustification: d?.shortlistJustification ?? "",
    biddingDocumentTeam: d?.biddingDocumentTeam ?? "",
    biddingTeamJustification: d?.biddingTeamJustification ?? "",
    evaluationCommittee: d?.evaluationCommittee ?? "",
    evaluationJustification: d?.evaluationJustification ?? "",
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

/** Each of rows 1–4: what the answer is, and where its justification goes. */
const PAIRS: Record<
  string,
  {
    answer: keyof PartTwoSubmission;
    answerLabel: string;
    answerHint: string;
    justification: keyof PartTwoSubmission;
    choices: string[];
  }
> = {
  "1": {
    answer: "recommendedMethod",
    answerLabel: "Method",
    answerHint: "e.g. Open Domestic Bidding",
    justification: "methodJustification",
    choices: METHOD_JUSTIFICATIONS,
  },
  "2": {
    answer: "shortlistedProviders",
    answerLabel: "Names of the provider(s)",
    answerHint: "One provider per line",
    justification: "shortlistJustification",
    choices: SELECTION_JUSTIFICATIONS,
  },
  "3": {
    answer: "biddingDocumentTeam",
    answerLabel: "Names and positions",
    answerHint: "Name — position, one per line",
    justification: "biddingTeamJustification",
    choices: TEAM_JUSTIFICATIONS,
  },
  "4": {
    answer: "evaluationCommittee",
    answerLabel: "Names and positions",
    answerHint: "Name — position, one per line",
    justification: "evaluationJustification",
    choices: EVALUATION_JUSTIFICATIONS,
  },
};

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

  /** One labelled part of a row: the answer or its justification. */
  const part = (label: string, body: ReactNode) => (
    <div>
      <div className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</div>
      {body}
    </div>
  );

  function submissionView(key: string) {
    const pair = PAIRS[key];
    if (pair) {
      const justification =
        submission[pair.justification] || (key === "1" && submission.recommendedMethod ? DEFAULT_JUSTIFICATION : "");
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          {part(pair.answerLabel, <div className="whitespace-pre-line text-gray-800">{submission[pair.answer] || emptyMark}</div>)}
          {part("Justification", <div className="whitespace-pre-line text-gray-800">{justification || emptyMark}</div>)}
        </div>
      );
    }
    const text =
      key === "5"
        ? submission.biddingDocumentCost
          ? `UGX ${Number(submission.biddingDocumentCost).toLocaleString("en-UG")}`
          : ""
        : submission.otherInformation;
    return <div className="whitespace-pre-line text-gray-800">{text || emptyMark}</div>;
  }

  function submissionInput(key: string) {
    const pair = PAIRS[key];
    if (pair) {
      const answer =
        key === "1" ? (
          <Combobox
            ariaLabel={`Row ${key}: ${pair.answerLabel}`}
            value={submission.recommendedMethod}
            onChange={(v) => set({ recommendedMethod: v })}
            options={PPDA_METHODS}
            placeholder={pair.answerHint}
            inputClassName="text-xs"
          />
        ) : (
          <textarea
            aria-label={`Row ${key}: ${pair.answerLabel}`}
            value={submission[pair.answer]}
            onChange={(e) => set({ [pair.answer]: e.target.value })}
            className="input text-xs"
            rows={3}
            placeholder={pair.answerHint}
          />
        );
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          {part(pair.answerLabel, answer)}
          {part(
            "Justification",
            <>
              <Combobox
                ariaLabel={`Row ${key}: justification`}
                value={submission[pair.justification]}
                onChange={(v) => set({ [pair.justification]: v })}
                options={pair.choices}
                placeholder="Type, or pick from the list"
                inputClassName="text-xs"
              />
              {key === "1" && !submission.methodJustification.trim() && (
                <p className="mt-1 text-[11px] leading-4 text-gray-500">
                  Left blank, the form prints: {DEFAULT_JUSTIFICATION}
                </p>
              )}
            </>
          )}
        </div>
      );
    }
    if (key === "5") {
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
    }
    return (
      <textarea
        value={submission.otherInformation}
        onChange={(e) => set({ otherInformation: e.target.value })}
        className="input text-xs"
        rows={2}
        placeholder="Anything else the committee should know"
      />
    );
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
          <Combobox
            ariaLabel={`Row ${key}: committee decision`}
            value={r.decision}
            onChange={(v) => onRowDecisionChange(key, { decision: v })}
            options={ROW_DECISIONS}
            placeholder="Decision"
            inputClassName="text-xs"
          />
        </td>
        <td className="px-2 py-2 align-top">
          <textarea
            value={r.conditions}
            onChange={(e) => onRowDecisionChange(key, { conditions: e.target.value })}
            className="input text-xs"
            rows={2}
            placeholder="Conditions"
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
                <th className="px-2 py-2 text-left w-1/4">Conditions for the decision</th>
              </>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {ROWS.map((row) => (
            <tr key={row.key}>
              <td className="px-2 py-2 align-top text-xs text-gray-400">{row.key}.</td>
              <td className="px-2 py-2 align-top">
                <div className="text-xs font-medium text-gray-600 mb-1.5">
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
    </div>
  );
}
