import { useEffect, useState, type ReactNode } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import Badge, { STATUS_TONES, statusLabel } from "../components/Badge";
import { ChevronLeftIcon, PlusIcon, PrinterIcon, SpinnerIcon } from "../components/icons";
import { KSS_BADGE } from "../lib/badge";
import { shillingsInWords } from "../lib/words";

interface POItem {
  id: number;
  description: string;
  quantity: string;
  unitOfMeasure: string | null;
  unitPrice: string;
  totalPrice: string;
}

interface PODetail {
  id: number;
  poNumber: string;
  status: string;
  issueDate: string | null;
  expectedDeliveryDate: string | null;
  deliveryLocation: string | null;
  totalAmount: string | null;
  termsAndConditions: string | null;
  createdAt: string;
  supplierName: string | null;
  supplierAddress: string | null;
  supplierPhone: string | null;
  procurementRequestId: number | null;
  referenceNumber: string | null;
  requestStatus: string | null;
  items: POItem[];
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

const money = (v: string | number | null | undefined) =>
  v === null || v === undefined || v === "" ? "" : Number(v).toLocaleString("en-UG");
const dayFirst = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export default function PurchaseOrderDetailPage() {
  const { id } = useParams();
  const { can } = useAuth();
  const [po, setPo] = useState<PODetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState("");

  function load() {
    setLoading(true);
    api
      .get<PODetail>(`/purchase-orders/${id}`)
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
              <h1 className="page-title">LPO No. {po.poNumber}</h1>
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
          <button type="button" onClick={() => printLpo(po)} className="btn btn-secondary">
            <PrinterIcon className="h-4 w-4" />
            Print LPO
          </button>
        </div>
      </div>

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
        <Field label="Expected delivery">{dayFirst(po.expectedDeliveryDate) || "—"}</Field>
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

/** The LPO laid out like a page from the school's LPO book, number in red. */
function printLpo(po: PODetail) {
  const total = po.items.reduce((s, it) => s + Number(it.totalPrice || 0), 0);
  const ROWS = 13;
  const rows = Array.from({ length: Math.max(ROWS, po.items.length) }, (_, i) => {
    const it = po.items[i];
    if (!it) return `<tr><td></td><td></td><td></td><td></td></tr>`;
    const qty = `${Number(it.quantity).toLocaleString("en-UG")}${it.unitOfMeasure ? ` ${esc(it.unitOfMeasure)}` : ""}`;
    return `<tr><td class="c">${qty}</td><td>${esc(it.description)}</td><td class="r">${money(it.unitPrice)}</td><td class="r">${money(it.totalPrice)}</td></tr>`;
  }).join("");
  const date = dayFirst(po.issueDate) || new Date(po.createdAt).toLocaleDateString("en-GB");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>LPO No. ${esc(po.poNumber)}</title>
<style>
@page { size: A4 portrait; margin: 14mm 16mm; }
* { box-sizing: border-box; }
body { margin: 0; color: #000; font-family: "Times New Roman", Times, serif; font-size: 14px; }
@media screen { body { padding: 14mm 16mm; max-width: 210mm; } }
.head { display: flex; align-items: center; gap: 14px; }
.head img { width: 86px; height: auto; }
.name { font-size: 29px; font-weight: bold; letter-spacing: 0.5px; }
.addr { font-family: Arial, Helvetica, sans-serif; font-size: 14px; font-weight: bold; margin-top: 2px; }
.bar-wrap { text-align: center; margin-top: 14px; }
.bar { display: inline-block; background: #1f1f1f; color: #fff; font-family: Arial, Helvetica, sans-serif; font-size: 16px; letter-spacing: 1px; padding: 7px 32px; }
.row { display: flex; justify-content: space-between; align-items: baseline; margin-top: 20px; font-weight: bold; }
.no { font-size: 16px; }
.no .red { color: #c0392b; font-size: 30px; font-weight: normal; letter-spacing: 1px; margin-left: 6px; }
.fill { font-family: Arial, Helvetica, sans-serif; font-weight: normal; }
.dots { display: inline-block; min-width: 170px; border-bottom: 2px dotted #000; padding: 0 6px 2px; }
.line { border-bottom: 2px dotted #000; min-height: 26px; padding: 4px 6px 2px; }
.to { margin-top: 22px; font-weight: bold; }
.to-first { display: flex; gap: 8px; align-items: flex-end; }
.to-first .line { flex: 1; }
.to-rest { margin-left: 44px; }
.lead { font-weight: bold; font-size: 15px; margin-top: 18px; }
table { width: 100%; border-collapse: collapse; margin-top: 3px; }
th, td { border: 2px solid #000; padding: 4px 8px; height: 31px; font-family: Arial, Helvetica, sans-serif; font-size: 13px; }
th { font-size: 16px; }
.c { text-align: center; }
.r { text-align: right; white-space: nowrap; }
.total { text-align: right; font-weight: bold; font-size: 16px; }
.quote { text-align: center; font-weight: bold; font-size: 15px; margin-top: 14px; }
.words { display: flex; gap: 8px; align-items: flex-end; margin-top: 20px; font-weight: bold; font-size: 15px; }
.words .line { flex: 1; font-size: 14px; }
.sign { display: flex; justify-content: space-between; margin-top: 30px; font-weight: bold; font-size: 15px; }
.sign > div { width: 40%; text-align: center; }
.sign .dots { display: block; min-width: 0; margin: 30px 0 10px; }
</style></head><body>
<div class="head">
  <img src="${KSS_BADGE}" alt="" />
  <div>
    <div class="name">KIBULI SECONDARY SCHOOL</div>
    <div class="addr">P.O Box 4216 Kampala - Uganda Tel: 0414 257339</div>
  </div>
</div>
<div class="bar-wrap"><span class="bar">LOCAL PURCHASE ORDER</span></div>
<div class="row">
  <div class="no">No. <span class="red">${esc(po.poNumber)}</span></div>
  <div>Date: <span class="dots fill">${date}</span></div>
</div>
<div class="to">
  <div class="to-first"><span>To:</span><div class="line fill">${esc(po.supplierName ?? "")}</div></div>
  <div class="to-rest">
    <div class="line fill">${esc(po.supplierAddress ?? "")}</div>
    <div class="line fill">${po.supplierPhone ? `Tel: ${esc(po.supplierPhone)}` : ""}</div>
  </div>
</div>
<div class="lead">Please supply / render the following goods / services:</div>
<table>
  <thead><tr><th style="width:17%">Quantity</th><th>Description</th><th style="width:17%">Unit Price</th><th style="width:21%">Amount</th></tr></thead>
  <tbody>
    ${rows}
    <tr><td></td><td colspan="2" class="total">TOTAL</td><td class="r"><strong>${money(total)}</strong></td></tr>
  </tbody>
</table>
<div class="quote">Please quote our Order number on your Invoice</div>
<div class="words"><span>Amount in words :</span><div class="line fill">${shillingsInWords(total)}</div></div>
<div class="line" style="margin-top:10px;"></div>
<div class="sign">
  <div>Prepared by<span class="dots"></span>Signature &amp; Title</div>
  <div>Authorised by<span class="dots"></span>Headteacher</div>
</div>
</body></html>`;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}
