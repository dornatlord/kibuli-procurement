import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import PageHeader from "../components/PageHeader";
import Badge, { STATUS_TONES, statusLabel } from "../components/Badge";
import { ChevronRightIcon, InboxIcon, PlusIcon } from "../components/icons";
import { ListSkeleton } from "../components/Loading";

interface PORow {
  id: number;
  poNumber: string;
  status: string;
  issueDate: string | null;
  expectedDeliveryDate: string | null;
  totalAmount: string | null;
  supplierName: string | null;
  referenceNumber: string | null;
  createdAt: string;
}

const dayFirst = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");

export default function PurchaseOrdersListPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<PORow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<PORow[]>("/purchase-orders")
      .then(setOrders)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Local purchase orders"
        subtitle="LPOs issued to suppliers, numbered from 1 in the order they're raised."
        actions={
          can("purchase_orders.create") && (
            <Link to="/purchase-orders/new" className="btn btn-primary">
              <PlusIcon className="h-4 w-4" />
              New LPO
            </Link>
          )
        }
      />

      <div className="card overflow-hidden">
        {loading ? (
          <ListSkeleton />
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-gray-100 text-gray-400">
              <InboxIcon className="h-6 w-6" />
            </span>
            <p className="mt-3 text-sm font-medium text-gray-900">No LPOs yet</p>
            <p className="mt-1 text-sm text-gray-500">Open a request and choose Create LPO.</p>
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
                {orders.map((po) => (
                  <tr
                    key={po.id}
                    onClick={() => navigate(`/purchase-orders/${po.id}`)}
                    className="group cursor-pointer transition hover:bg-gray-50"
                  >
                    <td className="px-4 py-3">
                      <Link
                        to={`/purchase-orders/${po.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-semibold tabular-nums text-red-700"
                      >
                        {po.poNumber}
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
