import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Navigate } from "react-router-dom";
import { ListSkeleton } from "../components/Loading";

interface LogRow {
  id: number;
  action: string;
  entityType: string;
  entityId: number | null;
  details: Record<string, unknown> | null;
  createdAt: string;
  userName: string | null;
  userEmail: string | null;
}

export default function AuditTrailPage() {
  const { can } = useAuth();
  const [rows, setRows] = useState<LogRow[]>([]);
  const [entityTypes, setEntityTypes] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);

  if (!can("audit.view")) return <Navigate to="/dashboard" replace />;

  useEffect(() => {
    api.get<string[]>("/audit-logs/entity-types").then(setEntityTypes);
  }, []);

  useEffect(() => {
    setLoading(true);
    const q = filter ? `?entityType=${encodeURIComponent(filter)}` : "";
    api.get<LogRow[]>(`/audit-logs${q}`).then(setRows).finally(() => setLoading(false));
  }, [filter]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Audit Trail</h1>
        <p className="text-sm text-gray-500 mt-1">Every recorded system action, for PPDA compliance.</p>
      </div>

      <div className="flex gap-3">
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="input max-w-xs">
          <option value="">All entity types</option>
          {entityTypes.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
        </select>
        <div className="ml-auto text-sm text-gray-400 self-center">{rows.length} entries</div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <ListSkeleton rows={8} />
        ) : rows.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-400">No activity recorded yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50/80 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2 text-left">When</th>
                <th className="px-4 py-2 text-left">Who</th>
                <th className="px-4 py-2 text-left">Action</th>
                <th className="px-4 py-2 text-left">Entity</th>
                <th className="px-4 py-2 text-left">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">
                    {new Date(r.createdAt).toLocaleString("en-UG")}
                  </td>
                  <td className="px-4 py-2 text-xs">{r.userName || "System"}</td>
                  <td className="px-4 py-2 font-mono text-xs">{r.action}</td>
                  <td className="px-4 py-2 text-xs text-gray-500">
                    {r.entityType}{r.entityId ? ` #${r.entityId}` : ""}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-400 font-mono max-w-xs truncate">
                    {r.details ? JSON.stringify(r.details) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
