import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Navigate } from "react-router-dom";
import Badge, { STATUS_TONES, statusLabel } from "../components/Badge";
import { ListSkeleton } from "../components/Loading";

interface ContractRow {
  id: number;
  contractNumber: string;
  title: string;
  contractValue: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  supplierName: string | null;
  referenceNumber: string | null;
}

export default function ContractsListPage() {
  const { can } = useAuth();
  const [rows, setRows] = useState<ContractRow[]>([]);
  const [loading, setLoading] = useState(true);

  if (!can("contracts.view")) return <Navigate to="/dashboard" replace />;

  useEffect(() => {
    api.get<ContractRow[]>("/contracts").then(setRows).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Contracts</h1>
          <p className="text-sm text-gray-500 mt-1">Signed agreements with suppliers and their amendments.</p>
        </div>
        {can("contracts.manage") && (
          <Link to="/contracts/new" className="btn btn-primary">
            + New Contract
          </Link>
        )}
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <ListSkeleton />
        ) : rows.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-400">No contracts yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50/80 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2 text-left">Contract #</th>
                <th className="px-4 py-2 text-left">Title</th>
                <th className="px-4 py-2 text-left">Supplier</th>
                <th className="px-4 py-2 text-right">Value</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono text-xs">{c.contractNumber}</td>
                  <td className="px-4 py-2">{c.title}</td>
                  <td className="px-4 py-2">{c.supplierName || "—"}</td>
                  <td className="px-4 py-2 text-right">{c.contractValue ? Number(c.contractValue).toLocaleString("en-UG") : "—"}</td>
                  <td className="px-4 py-2"><Badge tone={STATUS_TONES.contract[c.status] ?? "gray"} label={statusLabel(c.status)} /></td>
                  <td className="px-4 py-2"><Link to={`/contracts/${c.id}`} className="text-green-700 hover:underline text-xs">View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
