import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import { keepNames, namesForTitle, namesIn, useOfficials } from "../lib/officials";
import { useAuth } from "../lib/auth";
import { dayFirst as formDate } from "../lib/print";
import {
  CONFIRMED_BY_TITLE,
  DEPARTMENT_TITLES,
  callOffFill,
  headsFor,
  printCallOffOrder,
  printTForm,
  tformFill,
} from "../lib/forms/requestForms";
import type { CallOffFill, RequestRecord, TFormFill } from "../lib/forms/requestForms";
import { planOptions } from "../lib/planLines";
import type { PlanLines } from "../lib/planLines";
import PrintCheck from "../components/PrintCheck";
import type { CheckSection } from "../components/PrintCheck";
import StatusBadge from "../components/StatusBadge";
import { CheckIcon, ChevronLeftIcon, PlusIcon, PrinterIcon, SpinnerIcon } from "../components/icons";
import PartTwoTable, { rowDecisionsFrom, submissionFrom } from "../components/PartTwoForm";
import type { PartTwoSubmission, RowDecisions } from "../components/PartTwoForm";
import CorrectionPanel, { CorrectionHistory, toEditLines } from "../components/CorrectionPanel";

/** Part II while it is being edited on the request page. */
interface PartTwoDraft {
  submission: PartTwoSubmission;
  rowDecisions: RowDecisions;
  meetingReference: string;
  decision: string;
  decisionJustification: string;
}

/** The request as this page reads it: the printed record, and the budget line it spends. */
type Request = RequestRecord & { budgetItemId?: number | null; subProgrammeId?: number | null };

/** The LPO raised from this request, for the call-off order's provider and date. */
interface LinkedLpo {
  supplierName: string | null;
  issueDate: string | null;
  status: string;
}

/**
 * Actions available at each stage, gated by permission rather than role, so the
 * administrator (who holds every permission) sees them all.
 */
const NEXT_STATUS: Record<
  string,
  { permission: string; label: string; next: string }[]
> = {
  draft: [
    { permission: "requests.submit", label: "Submit to HoD", next: "pending_hod" },
  ],
  pending_hod: [
    { permission: "requests.approve.hod", label: "Approve → Accounting Officer", next: "pending_accounting_officer" },
    { permission: "requests.approve.hod", label: "Reject", next: "rejected" },
  ],
  pending_accounting_officer: [
    { permission: "requests.approve.accounting_officer", label: "Approve → Contracts Committee", next: "pending_contracts_committee" },
    { permission: "requests.approve.accounting_officer", label: "Reject", next: "rejected" },
  ],
  pending_contracts_committee: [
    { permission: "requests.approve.committee", label: "Approve", next: "approved" },
    { permission: "requests.approve.committee", label: "Reject", next: "rejected" },
  ],
};

export default function RequestDetailPage() {
  const { id } = useParams();
  const { can } = useAuth();
  const officials = useOfficials();
  const [request, setRequest] = useState<Request | null>(null);
  const [linkedLpo, setLinkedLpo] = useState<LinkedLpo | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  // Correcting the saved request (administrators and those given the right).
  const [correcting, setCorrecting] = useState(false);
  const [corrected, setCorrected] = useState(false);
  const [partTwoEdit, setPartTwoEdit] = useState<PartTwoDraft | null>(null);
  const [partTwoSaving, setPartTwoSaving] = useState(false);
  const [partTwoError, setPartTwoError] = useState("");
  // Checking the names, titles and dates a form will print, before printing it.
  const [checking, setChecking] = useState<"tform" | "calloff" | null>(null);
  const [plan, setPlan] = useState<PlanLines | null>(null);

  function load() {
    setLoading(true);
    api
      .get<Request>(`/requests/${id}`)
      .then(setRequest)
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [id]);

  // Loaded up front, so printing the call-off order needs no wait.
  useEffect(() => {
    if (!can("purchase_orders.view")) return;
    api
      .get<LinkedLpo[]>(`/purchase-orders?requestId=${id}`)
      .then((rows) => setLinkedLpo(rows.find((r) => r.status !== "cancelled") ?? null))
      .catch(() => setLinkedLpo(null));
  }, [id]);

  /** Opens the check before printing TFORM 5, with the year's plan lines to offer for page 2. */
  async function checkTForm() {
    if (!plan && request) {
      const lines = await api.get<PlanLines>(`/procurement-plan/lines?year=${request.year}`).catch(() => null);
      setPlan(lines);
    }
    setChecking("tform");
  }

  async function transition(next: string) {
    setActing(true);
    try {
      await api.patch(`/requests/${id}/status`, { status: next });
      load();
    } finally {
      setActing(false);
    }
  }

  function startPartTwoEdit() {
    const d = request?.decision ?? null;
    setPartTwoError("");
    setPartTwoEdit({
      submission: submissionFrom(d),
      rowDecisions: rowDecisionsFrom(d?.rowDecisions),
      meetingReference: d?.meetingReference ?? "",
      decision: d?.decision ?? "",
      decisionJustification: d?.decisionJustification ?? "",
    });
  }

  async function savePartTwo(e: React.FormEvent) {
    e.preventDefault();
    if (!partTwoEdit) return;
    setPartTwoError("");
    setPartTwoSaving(true);
    try {
      // Send only the side this person fills; the server ignores the rest anyway.
      await api.post(`/requests/${id}/committee-decision`, {
        ...(can("requests.prepare.committee") ? partTwoEdit.submission : {}),
        ...(can("requests.approve.committee")
          ? {
              rowDecisions: partTwoEdit.rowDecisions,
              meetingReference: partTwoEdit.meetingReference,
              decision: partTwoEdit.decision || null,
              decisionJustification: partTwoEdit.decisionJustification,
            }
          : {}),
      });
      setPartTwoEdit(null);
      load();
    } catch (err: unknown) {
      setPartTwoError(err instanceof Error ? err.message : "Failed to save Part II");
    } finally {
      setPartTwoSaving(false);
    }
  }

  if (loading)
    return (
      <div className="flex justify-center py-24">
        <SpinnerIcon className="h-6 w-6 text-green-700" />
      </div>
    );
  if (!request)
    return (
      <div className="card mx-auto max-w-md px-6 py-12 text-center">
        <p className="text-sm font-medium text-gray-900">Request not found</p>
        <Link to="/requests" className="btn btn-secondary btn-sm mt-4">
          Back to requests
        </Link>
      </div>
    );

  // A micro procurement is the Accounting Officer's to approve; only macro
  // procurements go on to the Contracts Committee.
  const steps =
    request.procurementSize === "micro" && request.status === "pending_accounting_officer"
      ? [
          { permission: "requests.approve.accounting_officer", label: "Approve", next: "approved" },
          { permission: "requests.approve.accounting_officer", label: "Reject", next: "rejected" },
        ]
      : NEXT_STATUS[request.status] || [];
  const actions = steps.filter((a) => can(a.permission));
  const canPrepare = can("requests.prepare.committee");
  const canDecide = can("requests.approve.committee");
  const meetingLine = [formDate(request.stepDates?.committeeMeeting), request.decision?.meetingReference]
    .filter(Boolean)
    .join(" / ");
  const itemsTotal = request.items.reduce((sum, it) => sum + Number(it.totalCost || 0), 0);
  // A step counts as done once it has a signature or a recorded date — the
  // administrator approves without signing, so the date is often all there is.
  const chain = [
    { role: "user_dept", label: "User department", at: request.stepDates?.requested },
    { role: "head_of_dept", label: "Head of Department", at: request.stepDates?.headOfDepartment },
    { role: "accounting_officer", label: "Accounting Officer", at: request.stepDates?.accountingOfficer },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link
          to="/requests"
          className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-900"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          Requests
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="page-title">{request.subjectOfProcurement || "Untitled request"}</h1>
              <StatusBadge status={request.status} />
            </div>
            <p className="mt-1 font-mono text-sm text-gray-500">{request.referenceNumber}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {can("requests.print") && (
              <>
                <button type="button" onClick={() => setChecking("calloff")} className="btn btn-secondary">
                  <PrinterIcon className="h-4 w-4" />
                  Call-off order & price schedule
                </button>
                <button type="button" onClick={checkTForm} className="btn btn-secondary">
                  <PrinterIcon className="h-4 w-4" />
                  Print TFORM 5
                </button>
              </>
            )}
            {can("records.correct") && !correcting && (
              <button
                type="button"
                onClick={() => {
                  setCorrecting(true);
                  setCorrected(false);
                }}
                className="btn btn-secondary"
              >
                Correct
              </button>
            )}
            {can("purchase_orders.create") && request.status !== "rejected" && (
              <Link to={`/purchase-orders/new?requestId=${request.id}`} className="btn btn-primary">
                <PlusIcon className="h-4 w-4" />
                Create LPO
              </Link>
            )}
          </div>
        </div>
      </div>

      {checking === "tform" && (
        <PrintCheck<TFormFill>
          key={`tform-${Object.keys(officials).length}`}
          title="Check TFORM 5 before printing"
          sections={tformSections(request, officials, plan)}
          initial={tformFill(request, officials)}
          onPrint={(fill, start) => {
            printTForm(request, fill);
            // Names typed or changed here are kept under their title, to be offered next time.
            const changed = (name: keyof TFormFill, title?: keyof TFormFill) =>
              fill[name].trim() !== start[name].trim() || (!!title && fill[title].trim() !== start[title].trim());
            keepNames([
              changed("requesterName", "requesterTitle") && { title: fill.requesterTitle, name: fill.requesterName },
              changed("hodName", "hodTitle") && { title: fill.hodTitle, name: fill.hodName },
              changed("aoName", "aoTitle") && { title: fill.aoTitle, name: fill.aoName },
              request.procurementSize === "macro" &&
                changed("pduName", "pduTitle") && { title: fill.pduTitle, name: fill.pduName },
              request.procurementSize === "macro" &&
                changed("chairName") && { office: "committee_chairperson", name: fill.chairName },
              request.procurementSize === "macro" &&
                changed("secretaryName") && { office: "committee_secretary", name: fill.secretaryName },
            ]);
          }}
          onClose={() => setChecking(null)}
        />
      )}
      {checking === "calloff" && (
        <PrintCheck<CallOffFill>
          key={`calloff-${Object.keys(officials).length}`}
          title="Check the call-off order before printing"
          sections={[
            {
              title: "Call-off order",
              fields: [
                { key: "provider", label: "Provider", options: linkedLpo?.supplierName ? [linkedLpo.supplierName] : [] },
                { key: "date", label: "Date of call-off order", type: "date" },
              ],
            },
            {
              title: "Authorised by",
              fields: [
                {
                  key: "authorisedName",
                  label: "Name",
                  options: (v) => [
                    ...namesForTitle(officials, v.authorisedPosition),
                    ...namesIn(officials, "accounting_officer", "head_teacher"),
                  ],
                },
                {
                  key: "authorisedPosition",
                  label: "Position",
                  options: [officials.accounting_officer?.title ?? "", "Accounting Officer", "Head Teacher"],
                },
              ],
            },
          ]}
          initial={callOffFill(officials, linkedLpo)}
          onPrint={(fill, start) => {
            printCallOffOrder(request, fill);
            if (fill.authorisedName.trim() !== start.authorisedName.trim() || fill.authorisedPosition !== start.authorisedPosition) {
              keepNames([{ title: fill.authorisedPosition, name: fill.authorisedName }]);
            }
          }}
          onClose={() => setChecking(null)}
        />
      )}

      {correcting && (
        <CorrectionPanel
          title={`Correct ${request.referenceNumber}`}
          fields={[
            { key: "subjectOfProcurement", label: "Subject of procurement" },
            { key: "procurementPlanReference", label: "Procurement plan reference" },
            { key: "locationForDelivery", label: "Location for delivery" },
            { key: "dateRequired", label: "Date required (delivery date)", type: "date" },
            { key: "weekNumber", label: "Week (of the term)" },
            { key: "term", label: "Term" },
          ]}
          initial={{
            subjectOfProcurement: request.subjectOfProcurement ?? "",
            procurementPlanReference: request.procurementPlanReference ?? "",
            locationForDelivery: request.locationForDelivery ?? "",
            dateRequired: request.dateRequired ? request.dateRequired.slice(0, 10) : "",
            weekNumber: request.weekNumber ? String(request.weekNumber) : "",
            term: request.term ? String(request.term) : "",
          }}
          lines={toEditLines(
            request.items.map((it) => ({
              id: it.id,
              description: it.description,
              quantity: it.quantity,
              unitOfMeasure: it.unitOfMeasure,
              price: it.estimatedUnitCost,
            }))
          )}
          priceLabel="Estimated unit cost"
          onSave={async ({ values, items, reason }) => {
            await api.put(`/requests/${request.id}/correct`, { ...values, items, reason });
            setCorrecting(false);
            setCorrected(true);
            load();
          }}
          onClose={() => setCorrecting(false)}
        />
      )}
      {corrected && (
        <p role="status" className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
          Corrected. The Audit Trail records what changed, and printing shows the corrected request.
        </p>
      )}

      {actions.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-amber-900">Action required</p>
            <p className="text-sm text-amber-800/80">This request is waiting on you.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {actions.map((a) => (
              <button
                key={a.next}
                type="button"
                onClick={() => transition(a.next)}
                disabled={acting}
                className={`btn ${a.next === "rejected" ? "btn-danger" : "btn-primary"}`}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <dl className="card grid gap-px overflow-hidden bg-gray-100 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Category">
          <span className="capitalize">{request.category?.replace("_", "-")}</span>
        </Field>
        <Field label="Budget category">
          <span className="capitalize">{request.budgetCategory}</span>
        </Field>
        <Field label="Procurement size">
          <span className="capitalize">{request.procurementSize}</span>
        </Field>
        <Field label="Supply code">{request.supplyCode || "—"}</Field>
        <Field label="Week and term">
          {request.weekNumber && request.term ? `Week ${request.weekNumber}, Term ${request.term}` : "—"}
        </Field>
        <Field label="Project code">
          {request.projectCode ? `${request.projectCode}${request.projectTitle ? ` · ${request.projectTitle}` : ""}` : "—"}
        </Field>
        <Field label="Location">{request.locationForDelivery || "—"}</Field>
        <Field label="Date required (delivery)">{formDate(request.dateRequired) || "—"}</Field>
        <Field label="Plan reference">{request.procurementPlanReference || "—"}</Field>
        <Field label="Estimated total">
          {request.estimatedTotalCost
            ? `UGX ${Number(request.estimatedTotalCost).toLocaleString("en-UG")}`
            : "—"}
        </Field>
      </dl>

      <section className="card overflow-hidden">
        <SectionHeader title="Procurement items" />
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="w-12 px-5 py-3">#</th>
                <th className="px-5 py-3">Description</th>
                <th className="px-5 py-3 text-right">Qty</th>
                <th className="px-5 py-3">Unit</th>
                <th className="px-5 py-3 text-right">Unit cost</th>
                <th className="px-5 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {request.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-gray-400">
                    No items on this request.
                  </td>
                </tr>
              ) : (
                request.items.map((it) => (
                  <tr key={it.id}>
                    <td className="px-5 py-3 text-gray-400">{it.itemNo}</td>
                    <td className="px-5 py-3 text-gray-900">{it.description}</td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {it.quantity ? Number(it.quantity).toLocaleString("en-UG") : "—"}
                    </td>
                    <td className="px-5 py-3 text-gray-600">{it.unitOfMeasure || "—"}</td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {it.estimatedUnitCost ? Number(it.estimatedUnitCost).toLocaleString("en-UG") : "—"}
                    </td>
                    <td className="px-5 py-3 text-right font-medium tabular-nums text-gray-900">
                      {it.totalCost ? Number(it.totalCost).toLocaleString("en-UG") : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {request.items.length > 0 && (
              <tfoot className="border-t border-gray-200 bg-gray-50/60">
                <tr>
                  <td colSpan={5} className="px-5 py-3 text-right text-sm font-medium text-gray-500">
                    Total (UGX)
                  </td>
                  <td className="px-5 py-3 text-right font-semibold tabular-nums text-gray-900">
                    {itemsTotal.toLocaleString("en-UG")}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      <section className="card overflow-hidden">
        <SectionHeader title="Approval chain" />
        <ol className="px-5 py-4">
          {chain.map((step, i) => {
            const sig = request.signatures.find((s) => s.role === step.role);
            const done = !!(sig || step.at);
            return (
              <li key={step.role} className="relative flex gap-3 pb-5 last:pb-0">
                {i < chain.length - 1 && (
                  <span
                    aria-hidden="true"
                    className={`absolute left-3 top-7 -ml-px h-[calc(100%-1.75rem)] w-px ${
                      done ? "bg-green-600/40" : "bg-gray-200"
                    }`}
                  />
                )}
                <span
                  className={`relative grid h-6 w-6 shrink-0 place-items-center rounded-full ${
                    done ? "bg-green-600 text-white" : "border-2 border-gray-300 bg-white"
                  }`}
                >
                  {done && <CheckIcon className="h-3.5 w-3.5" strokeWidth={3} />}
                </span>
                <div className="-mt-0.5">
                  <div className="text-sm font-medium text-gray-900">{step.label}</div>
                  <div className="text-sm text-gray-500">
                    {sig
                      ? `${sig.name} · ${formDate(sig.signedAt)}`
                      : step.at
                      ? `Done ${formDate(step.at)}`
                      : "Waiting"}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {/* FORM 5 Part II — macro procurements only */}
      {request.procurementSize === "macro" && (canPrepare || canDecide) && (
        <section className="card overflow-hidden">
          <SectionHeader
            title="Part II — Request to the Contracts Committee"
            action={
              !partTwoEdit && (
                <button type="button" onClick={startPartTwoEdit} className="btn btn-secondary btn-sm">
                  {request.decision ? "Edit Part II" : canPrepare ? "Prepare submission" : "Record decision"}
                </button>
              )
            }
          />
          <div className="space-y-4 p-5">
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <span className="text-gray-500">Date of submission to the committee: </span>
                {formDate(request.stepDates?.submittedToCommittee) || (
                  <span className="text-gray-400">fills in when the request reaches the committee</span>
                )}
              </div>
              <div>
                <span className="text-gray-500">Committee meeting: </span>
                {meetingLine || (
                  <span className="text-gray-400">fills in when the committee records its decision</span>
                )}
              </div>
            </div>

            {partTwoEdit ? (
              <form onSubmit={savePartTwo} className="space-y-4">
                {partTwoError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {partTwoError}
                  </div>
                )}
                <PartTwoTable
                  submission={partTwoEdit.submission}
                  onSubmissionChange={
                    canPrepare
                      ? (patch) =>
                          setPartTwoEdit((p) => p && { ...p, submission: { ...p.submission, ...patch } })
                      : undefined
                  }
                  showCommittee
                  rowDecisions={partTwoEdit.rowDecisions}
                  onRowDecisionChange={
                    canDecide
                      ? (row, patch) =>
                          setPartTwoEdit(
                            (p) =>
                              p && {
                                ...p,
                                rowDecisions: {
                                  ...p.rowDecisions,
                                  [row]: { ...(p.rowDecisions[row] ?? { decision: "", conditions: "" }), ...patch },
                                },
                              }
                          )
                      : undefined
                  }
                />
                {canDecide && (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <label className="label">Meeting reference</label>
                      <input
                        value={partTwoEdit.meetingReference}
                        onChange={(e) => setPartTwoEdit((p) => p && { ...p, meetingReference: e.target.value })}
                        className="input"
                        placeholder="e.g. Minute CC/05/2026"
                      />
                    </div>
                    <div>
                      <label className="label">Overall decision</label>
                      <select
                        value={partTwoEdit.decision}
                        onChange={(e) => setPartTwoEdit((p) => p && { ...p, decision: e.target.value })}
                        className="input"
                      >
                        <option value="">— Not decided yet —</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                        <option value="deferred">Deferred</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Decision justification</label>
                      <input
                        value={partTwoEdit.decisionJustification}
                        onChange={(e) => setPartTwoEdit((p) => p && { ...p, decisionJustification: e.target.value })}
                        className="input"
                      />
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <button type="submit" disabled={partTwoSaving} className="btn btn-primary">
                    {partTwoSaving ? "Saving…" : "Save Part II"}
                  </button>
                  <button type="button" onClick={() => setPartTwoEdit(null)} className="btn btn-secondary">
                    Cancel
                  </button>
                </div>
              </form>
            ) : request.decision ? (
              <>
                <PartTwoTable
                  submission={submissionFrom(request.decision)}
                  showCommittee
                  rowDecisions={rowDecisionsFrom(request.decision.rowDecisions)}
                />
                <div className="text-sm">
                  <span className="text-gray-500">Overall decision: </span>
                  {request.decision.decision ? (
                    <span
                      className={`font-semibold ${
                        request.decision.decision === "approved"
                          ? "text-green-700"
                          : request.decision.decision === "rejected"
                          ? "text-red-600"
                          : "text-amber-600"
                      }`}
                    >
                      {request.decision.decision.charAt(0).toUpperCase() + request.decision.decision.slice(1)}
                    </span>
                  ) : (
                    "Pending"
                  )}
                  {request.decision.decisionJustification && (
                    <span className="text-gray-600"> — {request.decision.decisionJustification}</span>
                  )}
                </div>
              </>
            ) : (
              <div className="text-sm text-gray-400">Nothing recorded yet.</div>
            )}
          </div>
        </section>
      )}

      {/* A signed contract, for approved purchases that need one */}
      {request.status === "approved" && can("contracts.manage") && (
        <div className="card flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-gray-900">Approved</p>
            <p className="text-sm text-gray-500">If this purchase needs a signed contract, record it here.</p>
          </div>
          <Link to={`/contracts/new?requestId=${request.id}`} className="btn btn-secondary">
            <PlusIcon className="h-4 w-4" />
            Create contract
          </Link>
        </div>
      )}

      <CorrectionHistory corrections={request.corrections} />
    </div>
  );
}

/** What the check before printing TFORM 5 asks about, page by page, with the choices for each. */
function tformSections(
  request: Request,
  officials: ReturnType<typeof useOfficials>,
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
        // The names kept under the title chosen beside it come first.
        { key: "requesterName", label: "Name", options: (v) => [...namesForTitle(officials, v.requesterTitle), ...people] },
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
          options: (v) => [
            ...namesForTitle(officials, v.hodTitle),
            ...namesIn(officials, "deputy_head_teacher"),
            ...heads,
          ],
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
          options: (v) => [
            ...namesForTitle(officials, v.aoTitle),
            ...namesIn(officials, "accounting_officer", "head_teacher"),
          ],
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
            options: (v) => [...namesForTitle(officials, v.pduTitle), ...namesIn(officials, "pdu_head")],
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

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-5 py-3.5">
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      {action}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-white px-5 py-4">
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-gray-900">{children}</dd>
    </div>
  );
}
