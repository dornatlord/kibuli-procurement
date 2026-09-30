import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { lpoNumber } from "../lib/forms/lpoForms";
import { kampalaYear, thisYear } from "../lib/years";
import PageHeader from "../components/PageHeader";
import Badge, { STATUS_TONES, statusLabel } from "../components/Badge";
import { ChevronRightIcon, InboxIcon, PlusIcon } from "../components/icons";
import { ListSkeleton } from "../components/Loading";

interface PORow {
  id: number;
  poNumber: string;
  year?: number | null;
  status: string;
  issueDate: string | null;
  expectedDeliveryDate: string | null;
  totalAmount: string | null;
  supplierName: string | null;
  referenceNumber: string | null;
  createdAt: string;
}

const dayFirst = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");
/** The LPO's numbering year. A copy of the list saved before LPOs had one falls back to when it was made. */
const yearOf = (po: PORow) => po.year ?? kampalaYear(new Date(po.createdAt));

/**
 * Does an LPO match what was typed? "3" finds LPO 3 of any year shown, "3/2025"
 * that year's LPO 3; anything else looks in the supplier and request reference.
 */
function matches(po: PORow, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const number = q.match(/^(?:lpo\s*(?:no\.?)?\s*)?(\d+)(?:\s*\/\s*(\d{4}))?$/);
  if (number) return po.poNumber === String(Number(number[1])) && (!number[2] || yearOf(po) === Number(number[2]));
  return `${po.supplierName ?? ""} ${po.referenceNumber ?? ""}`.toLowerCase().includes(q);
}

export default function PurchaseOrdersListPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<PORow[]>([]);
  const [loading, setLoading] = useState(true);
  // Numbers start again each year, so the list shows one year at a time: this
  // year to begin with, or every year at once.
  const [year, setYear] = useState<number | "all">(thisYear());
  const [query, setQuery] = useState("");

  useEffect(() => {
    api
      .get<PORow[]>("/purchase-orders")
      .then(setOrders)
      .finally(() => setLoading(false));
  }, []);

  const years = useMemo(() => {
    const found = new Set(orders.map(yearOf));
    found.add(thisYear());
    return [...found].sort((a, b) => b - a);
  }, [orders]);
  const shown = orders.filter((po) => (year === "all" || yearOf(po) === year) && matches(po, query));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Local purchase orders"
        subtitle="LPOs issued to suppliers. Numbers start again at 1 each year, like the LPO book."
        actions={
          can("purchase_orders.create") && (
            <Link to="/purchase-orders/new" className="btn btn-primary">
              <PlusIcon className="h-4 w-4" />
              New LPO
            </Link>
          )
        }
      />

      {!loading && orders.length > 0 && (
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="lpo-year" className="label">
              Year
            </label>
            <select
              id="lpo-year"
              className="input w-36"
              value={year}
              onChange={(e) => setYear(e.target.value === "all" ? "all" : Number(e.target.value))}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
              <option value="all">All years</option>
            </select>
          </div>
          <div className="min-w-[16rem] flex-1 sm:max-w-sm">
            <label htmlFor="lpo-find" className="label">
              Find
            </label>
            <input
              id="lpo-find"
              type="search"
              className="input"
              placeholder="LPO number (e.g. 3 or 3/2025), supplier or request"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <ListSkeleton />
        ) : shown.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-gray-100 text-gray-400">
              <InboxIcon className="h-6 w-6" />
            </span>
            {orders.length === 0 ? (
              <>
                <p className="mt-3 text-sm font-medium text-gray-900">No LPOs yet</p>
                <p className="mt-1 text-sm text-gray-500">Open a request and choose Create LPO.</p>
              </>
            ) : (
              <>
                <p className="mt-3 text-sm font-medium text-gray-900">
                  No LPOs {query.trim() ? "match that" : `in ${year}`}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  {year === "all" ? "Try another search." : "Choose another year, or All years."}
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">LPO No.</th>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3">Request</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Amount (UGX)</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="w-10 px-4 py-3">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {shown.map((po) => (
                  <tr
                    key={po.id}
                    onClick={() => navigate(`/purchase-orders/${po.id}`)}
                    className="group cursor-pointer transition hover:bg-gray-50"
                  >
                    <td className="px-4 py-3">
                      <Link
                        to={`/purchase-orders/${po.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="whitespace-nowrap font-semibold tabular-nums text-red-700"
                      >
                        {lpoNumber({ poNumber: po.poNumber, year: yearOf(po) })}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-900">{po.supplierName || "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{po.referenceNumber || "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                      {dayFirst(po.issueDate) || new Date(po.createdAt).toLocaleDateString("en-GB")}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                      {po.totalAmount ? Number(po.totalAmount).toLocaleString("en-UG") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS_TONES.po[po.status] ?? "gray"} label={statusLabel(po.status)} />
                    </td>
                    <td className="px-4 py-3 text-gray-300 group-hover:text-gray-500">
                      <ChevronRightIcon className="h-4 w-4" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
