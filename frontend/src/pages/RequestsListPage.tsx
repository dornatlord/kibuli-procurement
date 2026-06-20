import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import StatusBadge from "../components/StatusBadge";

interface Request {
  id: number;
  referenceNumber: string;
  subjectOfProcurement: string;
  status: string;
  category: string;
  budgetCategory: string;
  year: number;
  weekNumber: number;
  estimatedTotalCost: string;
  createdAt: string;
}

export default function RequestsListPage() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterYear, setFilterYear] = useState("");

  useEffect(() => {
    api
      .get<Request[]>("/requests")
      .then(setRequests)
      .finally(() => setLoading(false));
  }, []);

  const filtered = requests.filter((r) => {
    if (filterStatus && r.status !== filterStatus) return false;
    if (filterCategory && r.category !== filterCategory) return false;
    if (filterYear && String(r.year) !== filterYear) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">All Procurement Requests</h1>
        <Link
          to="/requests/new"
          className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-800"
        >
          + New Request
        </Link>
      </div>

      <div className="flex gap-3 flex-wrap">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="pending_hod">Pending HoD</option>
          <option value="pending_accounting_officer">Pending AO</option>
          <option value="pending_contracts_committee">Pending Committee</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
        >
          <option value="">All Categories</option>
          <option value="supplies">Supplies</option>
          <option value="works">Works</option>
          <option value="non_consultancy">Non-Consultancy</option>
        </select>
        <input
          type="number"
          placeholder="Year"
          value={filterYear}
          onChange={(e) => setFilterYear(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-24"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-gray-400 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-gray-400 text-sm">No requests found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-2 text-left">Reference</th>
                <th className="px-4 py-2 text-left">Subject</th>
                <th className="px-4 py-2 text-left">Cat</th>
                <th className="px-4 py-2 text-left">Budget</th>
                <th className="px-4 py-2 text-left">Year/Wk</th>
                <th className="px-4 py-2 text-right">Est. Cost</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono text-xs">{r.referenceNumber}</td>
                  <td className="px-4 py-2 max-w-xs truncate">{r.subjectOfProcurement || "—"}</td>
                  <td className="px-4 py-2 capitalize text-xs">{r.category?.replace("_", " ")}</td>
                  <td className="px-4 py-2 capitalize text-xs">{r.budgetCategory}</td>
                  <td className="px-4 py-2 text-xs">{r.year} / W{r.weekNumber}</td>
                  <td className="px-4 py-2 text-right text-xs">
                    {r.estimatedTotalCost ? Number(r.estimatedTotalCost).toLocaleString("en-UG") : "—"}
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
