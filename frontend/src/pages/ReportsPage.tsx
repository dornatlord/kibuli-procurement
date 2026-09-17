import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Navigate } from "react-router-dom";
import { statusLabel } from "../components/Badge";
import { PageLoading } from "../components/Loading";

interface GroupCount { count: number; total: string; }
interface Summary {
  totals: GroupCount;
  byStatus: (GroupCount & { status: string })[];
  byCategory: (GroupCount & { category: string })[];
  bySize: (GroupCount & { size: string })[];
}
interface BudgetRow {
  voteId: number;
  voteCode: string;
  voteName: string;
  budgeted: string;
  spent: string;
}
interface TopSupplier {
  supplierId: number;
  supplierName: string;
  poCount: number;
  poTotal: string;
}

function fmt(v: string | number) {
  return Number(v).toLocaleString("en-UG");
}

export default function ReportsPage() {
  const { can } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [budget, setBudget] = useState<BudgetRow[]>([]);
  const [topSuppliers, setTopSuppliers] = useState<TopSupplier[]>([]);
  const [loading, setLoading] = useState(true);

  if (!can("reports.view")) return <Navigate to="/dashboard" replace />;

  useEffect(() => {
    Promise.all([
      api.get<Summary>("/reports/summary"),
      api.get<BudgetRow[]>("/reports/budget-utilization"),
      api.get<TopSupplier[]>("/reports/top-suppliers"),
    ])
      .then(([s, b, t]) => {
        setSummary(s);
        setBudget(b);
        setTopSuppliers(t);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoading />;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="text-sm text-gray-500 mt-1">Spending, budget utilization and top suppliers.</p>
        </div>
        <Link to="/reports/monthly" className="text-sm text-green-700 hover:underline">View Monthly FORM 2 →</Link>
      </div>

      {summary && (
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Total Requests" value={summary.totals.count} sub={`UGX ${fmt(summary.totals.total)}`} />
          <StatCard
            label="Approved"
            value={summary.byStatus.find((s) => s.status === "approved")?.count ?? 0}
            sub={`UGX ${fmt(summary.byStatus.find((s) => s.status === "approved")?.total ?? 0)}`}
          />
          <StatCard
            label="In Progress"
            value={summary.byStatus.filter((s) => s.status.startsWith("pending_")).reduce((a, s) => a + Number(s.count), 0)}
          />
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-2 gap-4">
          <Breakdown title="By Category" rows={summary.byCategory.map((r) => ({ label: statusLabel(r.category), count: r.count, total: r.total }))} />
          <Breakdown title="By Procurement Size" rows={summary.bySize.map((r) => ({ label: statusLabel(r.size), count: r.count, total: r.total }))} />
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-600 uppercase">Budget Utilization by Vote</div>
        {budget.length === 0 ? (
          <div className="p-4 text-center text-gray-400 text-sm">No budget data yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50/80 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              <tr><th className="px-4 py-2 text-left">Vote</th><th className="px-4 py-2 text-right">Budgeted</th><th className="px-4 py-2 text-right">Spent (Approved)</th><th className="px-4 py-2 text-left">Utilization</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {budget.map((b) => {
                const pct = Number(b.budgeted) > 0 ? Math.min(100, (Number(b.spent) / Number(b.budgeted)) * 100) : 0;
                return (
                  <tr key={b.voteId}>
                    <td className="px-4 py-2">{b.voteCode} — {b.voteName}</td>
                    <td className="px-4 py-2 text-right">{fmt(b.budgeted)}</td>
                    <td className="px-4 py-2 text-right">{fmt(b.spent)}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full ${pct > 90 ? "bg-red-500" : pct > 70 ? "bg-amber-500" : "bg-green-600"}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-gray-500">{pct.toFixed(0)}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-600 uppercase">Top Suppliers by Purchase Order Value</div>
        {topSuppliers.length === 0 ? (
          <div className="p-4 text-center text-gray-400 text-sm">No purchase orders yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50/80 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              <tr><th className="px-4 py-2 text-left">Supplier</th><th className="px-4 py-2 text-right">Orders</th><th className="px-4 py-2 text-right">Total Value</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {topSuppliers.map((s) => (
                <tr key={s.supplierId}>
                  <td className="px-4 py-2">{s.supplierName}</td>
                  <td className="px-4 py-2 text-right">{s.poCount}</td>
                  <td className="px-4 py-2 text-right font-medium">{fmt(s.poTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="text-2xl font-bold text-gray-800">{value}</div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

function Breakdown({ title, rows }: { title: string; rows: { label: string; count: number; total: string }[] }) {
  return (
    <div className="card overflow-hidden">
      <div className="bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-600 uppercase">{title}</div>
      {rows.length === 0 ? (
        <div className="p-4 text-center text-gray-400 text-sm">No data.</div>
      ) : (
        <table className="w-full text-sm">
          <tbody className="divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.label}>
                <td className="px-4 py-2">{r.label}</td>
                <td className="px-4 py-2 text-right text-gray-500">{r.count}</td>
                <td className="px-4 py-2 text-right font-medium">{fmt(r.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
