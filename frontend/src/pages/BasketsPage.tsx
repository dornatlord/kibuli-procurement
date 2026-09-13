import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { basketLineLabel, money } from "../lib/baskets";
import type { BasketSummary } from "../lib/baskets";

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
          <h1 className="text-xl font-bold text-gray-800">Saved Baskets</h1>
          <p className="text-sm text-gray-500 mt-1">
            Lists of items you buy again and again — staff meals, weekly posho — that load into
            a new request in one click.
          </p>
        </div>
        <Link
          to="/baskets/new"
          className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-800"
        >
          + New Basket
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2 text-sm">
          {error}
        </div>
      )}

      {baskets === null ? (
        !error && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400 text-sm">
            Loading…
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
              <thead className="text-xs text-gray-500 uppercase bg-gray-50">
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
