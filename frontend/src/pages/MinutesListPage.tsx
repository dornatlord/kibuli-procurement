import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import PageHeader from "../components/PageHeader";
import Badge from "../components/Badge";
import { InboxIcon, PlusIcon } from "../components/icons";
import { ListSkeleton } from "../components/Loading";
import YearSelect from "../components/YearSelect";
import { useYearFilter } from "../lib/useYearFilter";
import { yearOf } from "../lib/years";
import { dayFirst } from "../lib/print";

interface Row {
  id: number;
  referenceNumber: string;
  meetingType: "ordinary" | "special";
  meetingDate: string;
  venue: string | null;
  status: "draft" | "final";
  itemCount: number;
}

export default function MinutesListPage() {
  const { can } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { year, setYear, years, shown } = useYearFilter(rows, (r) => yearOf(r.meetingDate));

  useEffect(() => {
    api
      .get<Row[]>("/meetings")
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load the minutes"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Committee minutes"
        subtitle="The Contracts Committee's meetings: who attended, what was decided, and who signed."
        actions={
          can("meetings.manage") && (
            <Link to="/minutes/new" className="btn btn-primary">
              <PlusIcon className="h-4 w-4" />
              New meeting
            </Link>
          )
        }
      />

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {!loading && rows.length > 0 && (
        <div className="flex items-end justify-between gap-3">
          <YearSelect id="minutes-year" value={year} years={years} onChange={setYear} allowAll />
          <div className="mb-2 text-sm text-gray-400">
            {shown.length} meeting{shown.length === 1 ? "" : "s"}
            {year === "all" ? "" : ` in ${year}`}
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
            <p className="mt-3 text-sm font-medium text-gray-900">
              {rows.length === 0 ? "No meetings recorded yet" : `No meetings in ${year}`}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {rows.length === 0
                ? can("meetings.manage")
                  ? "After a Contracts Committee meeting, record its minutes here."
                  : "The committee's secretary records the minutes here after each meeting."
                : "Choose another year, or All years."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Meeting</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Venue</th>
                  <th className="px-4 py-3 text-right">Matters</th>
                  <th className="px-4 py-3">Minutes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {shown.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/60">
                    <td className="px-4 py-3">
                      <Link to={`/minutes/${r.id}`} className="font-mono text-xs font-medium text-green-700 hover:underline">
                        {r.referenceNumber}
                      </Link>
                      <div className="text-xs text-gray-500">{r.meetingType === "special" ? "Special meeting" : "Ordinary meeting"}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{dayFirst(r.meetingDate)}</td>
                    <td className="px-4 py-3 text-gray-700">{r.venue || "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-700">{r.itemCount}</td>
                    <td className="px-4 py-3">
                      <Badge tone={r.status === "final" ? "green" : "amber"} label={r.status === "final" ? "Final" : "Draft"} />
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
