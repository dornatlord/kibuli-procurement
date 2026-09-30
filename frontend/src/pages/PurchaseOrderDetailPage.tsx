import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import { useOfficials } from "../lib/officials";
import { useAuth } from "../lib/auth";
import Badge, { STATUS_TONES, statusLabel } from "../components/Badge";
import { ChevronLeftIcon, PlusIcon, PrinterIcon, SpinnerIcon, XIcon } from "../components/icons";
import { shillingsInWords } from "../lib/words";
import { dayFirst, money } from "../lib/print";
import { completionDefaults, deliveryDateOf, lpoNumber, printCompletionCertificate, printLpo } from "../lib/forms/lpoForms";
import type { CompletionDetails, LpoRecord } from "../lib/forms/lpoForms";
import CorrectionPanel, { CorrectionHistory, toEditLines } from "../components/CorrectionPanel";

interface SupplierChoice {
  id: number;
  name: string;
}

/** Picking the supplier while correcting an LPO: type part of the name, choose from the register. */
function SupplierPicker({ value, onChange }: { value: SupplierChoice; onChange: (s: SupplierChoice) => void }) {
  const [text, setText] = useState(value.name);
  const [options, setOptions] = useState<SupplierChoice[]>([]);
  useEffect(() => {
    const q = text.trim();
    if (q.length < 2 || q === value.name) {
      setOptions([]);
      return;
    }
    const timer = window.setTimeout(() => {
      api
        .get<SupplierChoice[]>(`/suppliers/search?q=${encodeURIComponent(q)}`)
        .then(setOptions)
        .catch(() => setOptions([]));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [text, value.name]);
  return (
    <div className="relative sm:col-span-2">
      <label htmlFor="fix-supplier" className="label">
        Supplier
      </label>
      <input
        id="fix-supplier"
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoComplete="off"
        placeholder="Type part of the supplier's name"
        className="input"
      />
      {options.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-raised">
          {options.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                onChange(s);
                setText(s.name);
                setOptions([]);
              }}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-green-50"
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
      {text.trim() !== value.name && <p className="mt-1 text-xs text-amber-700">Choose the supplier from the list for the change to count.</p>}
    </div>
  );
}

const NEXT: Record<string, { next: string; label: string }[]> = {
  draft: [
    { next: "issued", label: "Issue to supplier" },
    { next: "cancelled", label: "Cancel LPO" },
  ],
  issued: [
    { next: "acknowledged", label: "Mark acknowledged" },
    { next: "cancelled", label: "Cancel LPO" },
  ],
  acknowledged: [
    { next: "completed", label: "Mark completed" },
    { next: "cancelled", label: "Cancel LPO" },
  ],
};

export default function PurchaseOrderDetailPage() {
  const { id } = useParams();
  const { can } = useAuth();
  const officials = useOfficials();
  const [po, setPo] = useState<LpoRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState("");
  const [certificate, setCertificate] = useState<CompletionDetails | null>(null);
  // Correcting the saved LPO (administrators and those given the right).
  const [fixSupplier, setFixSupplier] = useState<SupplierChoice | null>(null);
  const [corrected, setCorrected] = useState(false);

  function load() {
    setLoading(true);
    api
      .get<LpoRecord>(`/purchase-orders/${id}`)
      .then(setPo)
      .finally(() => setLoading(false));
  }
  useEffect(() => {
    load();
  }, [id]);

  async function transition(next: string) {
    setActing(true);
    setError("");
    try {
      await api.patch(`/purchase-orders/${id}/status`, { status: next });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the LPO");
    } finally {
      setActing(false);
    }
  }

  if (loading)
    return (
      <div className="flex justify-center py-24">
        <SpinnerIcon className="h-6 w-6 text-green-700" />
      </div>
    );
  if (!po)
    return (
      <div className="card mx-auto max-w-md px-6 py-12 text-center">
        <p className="text-sm font-medium text-gray-900">LPO not found</p>
        <Link to="/purchase-orders" className="btn btn-secondary btn-sm mt-4">
          Back to LPOs
        </Link>
      </div>
    );

  const actions = NEXT[po.status] || [];
  const awaitingApproval = po.procurementRequestId !== null && po.requestStatus !== "approved";
  const total = po.items.reduce((s, it) => s + Number(it.totalPrice || 0), 0);

  function printCertificate(e: FormEvent) {
    e.preventDefault();
    if (!po || !certificate) return;
    printCompletionCertificate(po, certificate);
    setCertificate(null);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link
          to="/purchase-orders"
          className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-900"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          LPOs
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="page-title">LPO No. {lpoNumber(po)}</h1>
              <Badge tone={STATUS_TONES.po[po.status] ?? "gray"} label={statusLabel(po.status)} />
            </div>
            <p className="mt-1 text-sm text-gray-500">
              {po.supplierName}
              {po.referenceNumber && po.procurementRequestId !== null && (
                <>
                  {" · "}
                  <Link
                    to={`/requests/${po.procurementRequestId}`}
                    className="font-mono text-green-700 hover:text-green-800"
                  >
                    {po.referenceNumber}
                  </Link>
                </>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCertificate(completionDefaults(po, officials))}
              className="btn btn-secondary"
            >
              <PrinterIcon className="h-4 w-4" />
              Completion certificate
            </button>
            <button type="button" onClick={() => printLpo(po, officials)} className="btn btn-secondary">
              <PrinterIcon className="h-4 w-4" />
              Print LPO
            </button>
            {can("records.correct") && !fixSupplier && (
              <button
                type="button"
                onClick={() => {
                  setFixSupplier({ id: po.supplierId ?? 0, name: po.supplierName ?? "" });
                  setCorrected(false);
                }}
                className="btn btn-secondary"
              >
                Correct
              </button>
            )}
          </div>
        </div>
      </div>

      {fixSupplier && (
        <CorrectionPanel
          title={`Correct LPO No. ${lpoNumber(po)}`}
          fields={[
            { key: "issueDate", label: "LPO date", type: "date" },
            { key: "expectedDeliveryDate", label: "Delivery date", type: "date" },
            { key: "deliveryLocation", label: "Delivery place" },
            { key: "termsAndConditions", label: "Terms and conditions", type: "textarea" },
          ]}
          initial={{
            issueDate: po.issueDate ? po.issueDate.slice(0, 10) : "",
            expectedDeliveryDate: po.expectedDeliveryDate ? po.expectedDeliveryDate.slice(0, 10) : "",
            deliveryLocation: po.deliveryLocation ?? "",
            termsAndConditions: po.termsAndConditions ?? "",
          }}
          extra={<SupplierPicker value={fixSupplier} onChange={setFixSupplier} />}
          lines={toEditLines(
            po.items.map((it) => ({
              id: it.id,
              description: it.description,
              quantity: it.quantity,
              unitOfMeasure: it.unitOfMeasure,
              price: it.unitPrice,
            }))
          )}
          onSave={async ({ values, items, reason }) => {
            await api.put(`/purchase-orders/${po.id}/correct`, { ...values, supplierId: fixSupplier.id, items, reason });
            setFixSupplier(null);
            setCorrected(true);
            load();
          }}
          onClose={() => setFixSupplier(null)}
        />
      )}
      {corrected && (
        <p role="status" className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
          Corrected. The Audit Trail records what changed, and printing shows the corrected LPO.
        </p>
      )}

      {certificate && (
        <form onSubmit={printCertificate} className="card space-y-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Completion certificate</h2>
              <p className="mt-0.5 text-sm text-gray-500">
                Filled in from this LPO and the officials. Check the details, then print for signing.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCertificate(null)}
              className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Close"
            >
              <XIcon className="h-5 w-5" />
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <CertificateField label="Date">
              <input
                type="date"
                className="input"
                value={certificate.date}
                onChange={(e) => setCertificate((c) => c && { ...c, date: e.target.value })}
              />
            </CertificateField>
            <CertificateField label="Department">
              <input
                className="input"
                value={certificate.department}
                onChange={(e) => setCertificate((c) => c && { ...c, department: e.target.value })}
              />
            </CertificateField>
            <CertificateField label="Service" wide>
              <input
                className="input"
                value={certificate.service}
                onChange={(e) => setCertificate((c) => c && { ...c, service: e.target.value })}
              />
            </CertificateField>
            <CertificateField label="Has completed the" wide>
              <textarea
                className="input"
                rows={3}
                value={certificate.completed}
                onChange={(e) => setCertificate((c) => c && { ...c, completed: e.target.value })}
              />
            </CertificateField>
            <CertificateField label="Submitted by (Contract Manager)">
              <input
                className="input"
                list="official-names"
                value={certificate.submittedBy}
                onChange={(e) => setCertificate((c) => c && { ...c, submittedBy: e.target.value })}
              />
            </CertificateField>
            <CertificateField label="Verified by (Deputy Headteacher)">
              <input
                className="input"
                list="official-names"
                value={certificate.verifiedBy}
                onChange={(e) => setCertificate((c) => c && { ...c, verifiedBy: e.target.value })}
              />
            </CertificateField>
            <CertificateField label="Approved by (Headteacher)">
              <input
                className="input"
                list="official-names"
                value={certificate.approvedBy}
                onChange={(e) => setCertificate((c) => c && { ...c, approvedBy: e.target.value })}
              />
            </CertificateField>
          </div>
          <datalist id="official-names">
            {Array.from(new Set(Object.values(officials).map((o) => o.name))).map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary">
              <PrinterIcon className="h-4 w-4" />
              Print certificate
            </button>
            <button type="button" onClick={() => setCertificate(null)} className="btn btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      )}

      {awaitingApproval && po.status === "draft" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          The request behind this LPO isn't approved yet ({statusLabel(po.requestStatus ?? "draft")}). The LPO can't be
          issued to the supplier until it is.
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {can("purchase_orders.manage") && actions.length > 0 && (
        <div className="card flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <p className="text-sm font-semibold text-gray-900">Next step</p>
          <div className="flex flex-wrap gap-2">
            {actions.map((a) => (
              <button
                key={a.next}
                type="button"
                onClick={() => transition(a.next)}
                disabled={acting || (a.next === "issued" && awaitingApproval)}
                className={`btn ${a.next === "cancelled" ? "btn-secondary" : "btn-primary"}`}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <dl className="card grid gap-px overflow-hidden bg-gray-100 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Date">{dayFirst(po.issueDate) || new Date(po.createdAt).toLocaleDateString("en-GB")}</Field>
        <Field label="Delivery date">{dayFirst(deliveryDateOf(po)) || "—"}</Field>
        <Field label="Deliver to">{po.deliveryLocation || "—"}</Field>
        <Field label="Total (UGX)">{money(total) || "—"}</Field>
      </dl>

      <section className="card overflow-hidden">
        <div className="border-b border-gray-200 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-gray-900">Goods and services</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-3 text-right">Quantity</th>
                <th className="px-5 py-3">Description</th>
                <th className="px-5 py-3 text-right">Unit price</th>
                <th className="px-5 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {po.items.map((it) => (
                <tr key={it.id}>
                  <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums">
                    {Number(it.quantity).toLocaleString("en-UG")} {it.unitOfMeasure}
                  </td>
                  <td className="px-5 py-3 text-gray-900">{it.description}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums">{money(it.unitPrice)}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-right font-medium tabular-nums">
                    {money(it.totalPrice)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-gray-200 bg-gray-50/60">
              <tr>
                <td colSpan={3} className="px-5 py-3 text-right text-sm font-medium text-gray-500">
                  Total (UGX)
                </td>
                <td className="px-5 py-3 text-right font-semibold tabular-nums text-gray-900">{money(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="border-t border-gray-100 px-5 py-3 text-sm text-gray-500">In words: {shillingsInWords(total)}</p>
      </section>

      {po.termsAndConditions && (
        <section className="card px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Terms and conditions</h2>
          <p className="mt-1 whitespace-pre-line text-sm text-gray-600">{po.termsAndConditions}</p>
        </section>
      )}

      {po.status === "acknowledged" && can("goods_received.create") && (
        <Link to={`/goods-received/new?poId=${po.id}`} className="btn btn-primary">
          <PlusIcon className="h-4 w-4" />
          Record goods received
        </Link>
      )}

      <CorrectionHistory corrections={po.corrections} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="bg-white px-5 py-4">
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-gray-900">{children}</dd>
    </div>
  );
}

function CertificateField({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <label className={`block ${wide ? "sm:col-span-2" : ""}`}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
