import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { basketLineLabel, money } from "../lib/baskets";
import type { BasketSummary } from "../lib/baskets";
import { ListSkeleton } from "../components/Loading";

export default function BasketsPage() {
  const navigate = useNavigate();
  const [baskets, setBaskets] = useState<BasketSummary[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<BasketSummary[]>("/baskets")
      .then(setBaskets)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load baskets"));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Saved Baskets</h1>
          <p className="text-sm text-gray-500 mt-1">
            Lists of items you buy again and again — staff meals, weekly posho — that load into
            a new request in one click.
          </p>
        </div>
        <Link
          to="/baskets/new"
          className="btn btn-primary"
        >
          + New Basket
        </Link>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {baskets === null ? (
        !error && (
          <div className="card overflow-hidden">
            <ListSkeleton rows={3} />
          </div>
        )
      ) : baskets.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-500 space-y-2">
          <div className="font-medium text-gray-700">No baskets yet</div>
          <p>
            The quickest way to make one: on a new request, pick the items and quantities you buy
            regularly, then press <strong>Save these items as a basket</strong> under the items
            table. You can also build one here with <strong>+ New Basket</strong>.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/80 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2 text-left">Basket</th>
                  <th className="px-4 py-2 text-left">Offered for</th>
                  <th className="px-4 py-2 text-right">Items</th>
                  <th className="px-4 py-2 text-right">Estimated value (UGX)</th>
                  <th className="px-4 py-2 text-left">Made by</th>
                  <th className="px-4 py-2 text-left">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {baskets.map((b) => (
                  <tr
                    key={b.id}
                    onClick={() => navigate(`/baskets/${b.id}`)}
                    className="hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-4 py-2">
                      <Link
                        to={`/baskets/${b.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-medium text-gray-800 hover:text-green-800"
                      >
                        {b.name}
                      </Link>
                      {b.description && <div className="text-xs text-gray-500">{b.description}</div>}
                    </td>
                    <td className="px-4 py-2 text-gray-600">
                      {basketLineLabel(b) ?? <span className="text-gray-400">Any budget line</span>}
                    </td>
                    <td className="px-4 py-2 text-right">{b.itemCount}</td>
                    <td className="px-4 py-2 text-right">
                      {Number(b.estimatedValue) > 0 ? money(b.estimatedValue) : "—"}
                    </td>
                    <td className="px-4 py-2 text-gray-600">{b.createdByName ?? "—"}</td>
                    <td className="px-4 py-2 text-gray-500">
                      {b.updatedAt ? new Date(b.updatedAt).toLocaleDateString("en-GB") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400">
            Estimated value uses each basket's usual quantities at today's price-list prices.
          </p>
        </div>
      )}
    </div>
  );
}
