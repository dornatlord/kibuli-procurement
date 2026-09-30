import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import { useOfficials } from "../lib/officials";
import { useAuth } from "../lib/auth";
import { dayFirst as formDate } from "../lib/print";
import { printCallOffOrder, printPriceSchedule, printTForm } from "../lib/forms/requestForms";
import type { RequestRecord as Request } from "../lib/forms/requestForms";
import StatusBadge from "../components/StatusBadge";
import { CheckIcon, ChevronLeftIcon, PlusIcon, PrinterIcon, SpinnerIcon } from "../components/icons";
import PartTwoTable, { rowDecisionsFrom, submissionFrom } from "../components/PartTwoForm";
import type { PartTwoSubmission, RowDecisions } from "../components/PartTwoForm";

/** Part II while it is being edited on the request page. */
interface PartTwoDraft {
  submission: PartTwoSubmission;
  rowDecisions: RowDecisions;
  meetingReference: string;
  decision: string;
  decisionJustification: string;
}

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
  const [partTwoEdit, setPartTwoEdit] = useState<PartTwoDraft | null>(null);
  const [partTwoSaving, setPartTwoSaving] = useState(false);
  const [partTwoError, setPartTwoError] = useState("");

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
                <button type="button" onClick={() => printPriceSchedule(request)} className="btn btn-secondary">
                  <PrinterIcon className="h-4 w-4" />
                  Price schedule
                </button>
                <button
                  type="button"
                  onClick={() =>
                    printCallOffOrder(request, officials, {
                      provider: linkedLpo?.supplierName ?? null,
                      date: linkedLpo?.issueDate ?? null,
                    })
                  }
                  className="btn btn-secondary"
                >
                  <PrinterIcon className="h-4 w-4" />
                  Call-off order
                </button>
                <button type="button" onClick={() => printTForm(request, officials)} className="btn btn-secondary">
                  <PrinterIcon className="h-4 w-4" />
                  Print TFORM 5
                </button>
              </>
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
    </div>
  );
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
