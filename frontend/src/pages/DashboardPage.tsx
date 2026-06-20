import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import StatusBadge from "../components/StatusBadge";

interface Request {
  id: number;
  referenceNumber: string;
  subjectOfProcurement: string;
  status: string;
  category: string;
  estimatedTotalCost: string;
  createdAt: string;
}

const ROLE_FILTER: Record<string, string[]> = {
  user_dept_member: ["draft", "pending_hod"],
  head_of_dept: ["pending_hod"],
  accounting_officer: ["pending_accounting_officer"],
  procurement_unit: ["pending_contracts_committee"],
  contracts_chair: ["pending_contracts_committee"],
  contracts_secretary: ["pending_contracts_committee"],
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<Request[]>("/requests")
      .then((all) => {
        const filters = ROLE_FILTER[user?.role ?? ""] ?? [];
        if (user?.role === "accounting_officer") {
          setRequests(all);
        } else {
          setRequests(all.filter((r) => filters.includes(r.status)));
        }
      })
      .finally(() => setLoading(false));
  }, [user]);

  const pending = requests.filter((r) => r.status.startsWith("pending_")).length;
  const approved = requests.filter((r) => r.status === "approved").length;
  const drafts = requests.filter((r) => r.status === "draft").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
        <Link
          to="/requests/new"
          className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-800"
        >
          + New Procurement Request
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Pending Action" value={pending} color="amber" />
        <StatCard label="Approved" value={approved} color="green" />
        <StatCard label="Drafts" value={drafts} color="gray" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-100 font-semibold text-sm text-gray-700">
          {user?.role === "accounting_officer" ? "All Requests" : "Requests Needing Your Attention"}
        </div>
        {loading ? (
          <div className="p-6 text-center text-gray-400 text-sm">Loading…</div>
        ) : requests.length === 0 ? (
          <div className="p-6 text-center text-gray-400 text-sm">No requests to show.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-2 text-left">Reference</th>
                <th className="px-4 py-2 text-left">Subject</th>
                <th className="px-4 py-2 text-left">Category</th>
                <th className="px-4 py-2 text-right">Est. Cost (UGX)</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {requests.slice(0, 20).map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono text-xs text-gray-600">{r.referenceNumber}</td>
                  <td className="px-4 py-2">{r.subjectOfProcurement || "—"}</td>
                  <td className="px-4 py-2 capitalize">{r.category?.replace("_", " ")}</td>
                  <td className="px-4 py-2 text-right">
                    {r.estimatedTotalCost
                      ? Number(r.estimatedTotalCost).toLocaleString("en-UG")
                      : "—"}
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-2">
                    <Link to={`/requests/${r.id}`} className="text-green-700 hover:underline text-xs">
                      View
                    </Link>
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

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    amber: "bg-amber-50 border-amber-200 text-amber-800",
    green: "bg-green-50 border-green-200 text-green-800",
    gray: "bg-gray-50 border-gray-200 text-gray-700",
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm mt-1">{label}</div>
    </div>
  );
}
