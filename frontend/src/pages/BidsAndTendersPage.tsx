import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Navigate } from "react-router-dom";
import StatusBadge from "../components/StatusBadge";

interface Request {
  id: number;
  referenceNumber: string;
  subjectOfProcurement: string;
  status: string;
  estimatedTotalCost: string | null;
  createdAt: string;
}

export default function BidsAndTendersPage() {
  const { can } = useAuth();
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);

  if (!can("requests.view.all", "requests.prepare.committee", "requests.approve.committee")) {
    return <Navigate to="/dashboard" replace />;
  }

  useEffect(() => {
    api
      .get<Request[]>("/requests?procurementSize=macro")
      .then((all) => setRequests(all.filter((r) => r.status !== "draft" && r.status !== "pending_hod")))
      .finally(() => setLoading(false));
  }, []);

  const pending = requests.filter((r) => r.status === "pending_contracts_committee");
  const others = requests.filter((r) => r.status !== "pending_contracts_committee");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Bids &amp; Tenders</h1>
        <p className="text-sm text-gray-500 mt-1">
          Macro procurements at the Contracts Committee stage. Open a request to prepare the submission or record the decision.
        </p>
      </div>

      <Section title="Awaiting Committee Decision" rows={pending} loading={loading} />
      <Section title="Other Macro Procurements" rows={others} loading={loading} />
    </div>
  );
}

function Section({ title, rows, loading }: { title: string; rows: Request[]; loading: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-2 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">{title}</div>
      {loading ? (
        <div className="p-6 text-center text-gray-400 text-sm">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="p-6 text-center text-gray-400 text-sm">Nothing here.</div>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-xs text-gray-500 uppercase bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left">Reference</th>
              <th className="px-4 py-2 text-left">Subject</th>
              <th className="px-4 py-2 text-right">Est. Cost</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 font-mono text-xs">{r.referenceNumber}</td>
                <td className="px-4 py-2">{r.subjectOfProcurement || "—"}</td>
                <td className="px-4 py-2 text-right">{r.estimatedTotalCost ? Number(r.estimatedTotalCost).toLocaleString("en-UG") : "—"}</td>
                <td className="px-4 py-2"><StatusBadge status={r.status} /></td>
                <td className="px-4 py-2"><Link to={`/requests/${r.id}`} className="text-green-700 hover:underline text-xs">Open</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
