import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { lpoNumber } from "../lib/forms/lpoForms";
import { useAuth } from "../lib/auth";
import { Navigate } from "react-router-dom";
import Badge, { STATUS_TONES, statusLabel } from "../components/Badge";
import { ListSkeleton } from "../components/Loading";
import YearSelect from "../components/YearSelect";
import { useYearFilter } from "../lib/useYearFilter";
import { yearOf } from "../lib/years";

interface GRNRow {
  id: number;
  grnNumber: string;
  status: string;
  receivedDate: string;
  poNumber: string | null;
  poYear?: number | null;
  supplierName: string | null;
  receivedByName: string | null;
}

export default function GoodsReceivedListPage() {
  const { can } = useAuth();
  const allowed = can("goods_received.view");
  const [rows, setRows] = useState<GRNRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { year, setYear, years, shown } = useYearFilter(rows, (g) => yearOf(g.receivedDate));

  useEffect(() => {
    if (!allowed) return;
    api.get<GRNRow[]>("/goods-received").then(setRows).finally(() => setLoading(false));
  }, [allowed]);

  if (!allowed) return <Navigate to="/dashboard" replace />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Goods Received</h1>
        <p className="text-sm text-gray-500 mt-1">Delivery notes recorded against purchase orders.</p>
      </div>

      {!loading && rows.length > 0 && (
        <div className="flex items-end justify-between gap-3">
          <YearSelect id="grn-year" value={year} years={years} onChange={setYear} allowAll />
          <div className="mb-2 text-sm text-gray-400">
            {shown.length} deliver{shown.length === 1 ? "y" : "ies"}
            {year === "all" ? "" : ` received in ${year}`}
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <ListSkeleton />
        ) : rows.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-400">
            No deliveries recorded yet. Record one from an acknowledged purchase order.
          </div>
        ) : shown.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-400">
            No deliveries in {year}. Choose another year, or All years.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50/80 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2 text-left">GRN Number</th>
                <th className="px-4 py-2 text-left">PO Number</th>
                <th className="px-4 py-2 text-left">Supplier</th>
                <th className="px-4 py-2 text-left">Received</th>
                <th className="px-4 py-2 text-left">By</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {shown.map((g) => (
                <tr key={g.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono text-xs">{g.grnNumber}</td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-500">{lpoNumber({ poNumber: g.poNumber, year: g.poYear }) || "—"}</td>
                  <td className="px-4 py-2">{g.supplierName || "—"}</td>
                  <td className="px-4 py-2 text-xs">{g.receivedDate}</td>
                  <td className="px-4 py-2 text-xs text-gray-500">{g.receivedByName || "—"}</td>
                  <td className="px-4 py-2"><Badge tone={STATUS_TONES.grn[g.status] ?? "gray"} label={statusLabel(g.status)} /></td>
                  <td className="px-4 py-2"><Link to={`/goods-received/${g.id}`} className="text-green-700 hover:underline text-xs">View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
