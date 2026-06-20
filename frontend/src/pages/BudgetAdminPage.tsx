import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Navigate } from "react-router-dom";

interface Vote { id: number; code: string; name: string; displayOrder: number; }
interface SubProgramme { id: number; voteId: number; romanNumeral: string | null; name: string; displayOrder: number; }
interface BudgetItem { id: number; voteId: number; subProgrammeId: number | null; name: string; budgetedAmount: string | null; displayOrder: number; }

export default function BudgetAdminPage() {
  const { user } = useAuth();
  const [votes, setVotes] = useState<Vote[]>([]);
  const [subs, setSubs] = useState<SubProgramme[]>([]);
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<Record<number, boolean>>({});

  if (!["accounting_officer", "head_of_dept"].includes(user?.role ?? "")) {
    return <Navigate to="/dashboard" replace />;
  }

  useEffect(() => {
    Promise.all([
      api.get<Vote[]>("/lookup/votes"),
    ]).then(async ([vs]) => {
      setVotes(vs);
      const allSubs: SubProgramme[] = [];
      const allItems: BudgetItem[] = [];
      for (const v of vs) {
        const [spList, biList] = await Promise.all([
          api.get<SubProgramme[]>(`/lookup/votes/${v.id}/sub-programmes`),
          api.get<BudgetItem[]>(`/lookup/votes/${v.id}/items`),
        ]);
        allSubs.push(...spList);
        allItems.push(...biList);
        for (const sp of spList) {
          const spItems = await api.get<BudgetItem[]>(`/lookup/sub-programmes/${sp.id}/items`);
          allItems.push(...spItems);
        }
      }
      setSubs(allSubs);
      // Deduplicate
      const seen = new Set<number>();
      setItems(allItems.filter((i) => { if (seen.has(i.id)) return false; seen.add(i.id); return true; }));
    }).finally(() => setLoading(false));
  }, []);

  async function save(itemId: number) {
    setSaving((p) => ({ ...p, [itemId]: true }));
    try {
      await api.patch(`/budget/items/${itemId}`, { budgetedAmount: editing[itemId] });
      setItems((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, budgetedAmount: editing[itemId] } : i))
      );
      setEditing((p) => { const n = { ...p }; delete n[itemId]; return n; });
    } finally {
      setSaving((p) => ({ ...p, [itemId]: false }));
    }
  }

  if (loading) return <div className="text-center py-12 text-gray-400">Loading budget structure…</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Budget Amounts</h1>
      <p className="text-sm text-gray-500">Confidential — only visible to Accounting Officer and Head Teacher.</p>

      {votes.map((v) => {
        const vSubs = subs.filter((s) => s.voteId === v.id);
        const flatItems = items.filter((i) => i.voteId === v.id);

        return (
          <div key={v.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="bg-green-800 text-white px-4 py-2 text-sm font-semibold">
              {v.code} — {v.name}
            </div>

            {vSubs.length === 0 ? (
              <ItemsTable
                items={flatItems}
                editing={editing}
                saving={saving}
                setEditing={setEditing}
                save={save}
              />
            ) : (
              vSubs.map((sp) => {
                const spItems = flatItems.filter((i) => i.subProgrammeId === sp.id);
                return (
                  <div key={sp.id}>
                    <div className="px-4 py-1.5 bg-gray-50 text-xs font-semibold text-gray-600 border-b border-gray-100">
                      {sp.romanNumeral ? `${sp.romanNumeral} ` : ""}{sp.name}
                    </div>
                    <ItemsTable
                      items={spItems}
                      editing={editing}
                      saving={saving}
                      setEditing={setEditing}
                      save={save}
                    />
                  </div>
                );
              })
            )}
          </div>
        );
      })}
    </div>
  );
}

function ItemsTable({
  items,
  editing,
  saving,
  setEditing,
  save,
}: {
  items: BudgetItem[];
  editing: Record<number, string>;
  saving: Record<number, boolean>;
  setEditing: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  save: (id: number) => void;
}) {
  if (items.length === 0) return <div className="px-4 py-2 text-xs text-gray-400 italic">No items</div>;
  return (
    <table className="w-full text-sm">
      <tbody className="divide-y divide-gray-50">
        {items.map((item) => (
          <tr key={item.id} className="hover:bg-gray-50">
            <td className="px-4 py-2">{item.name}</td>
            <td className="px-4 py-2 w-48">
              {item.id in editing ? (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={editing[item.id]}
                    onChange={(e) =>
                      setEditing((p) => ({ ...p, [item.id]: e.target.value }))
                    }
                    className="border border-gray-300 rounded px-2 py-1 text-xs w-32 text-right"
                    min="0"
                    step="1"
                    autoFocus
                  />
                  <button
                    onClick={() => save(item.id)}
                    disabled={saving[item.id]}
                    className="text-xs text-green-700 font-medium hover:underline"
                  >
                    Save
                  </button>
                  <button
                    onClick={() =>
                      setEditing((p) => {
                        const n = { ...p };
                        delete n[item.id];
                        return n;
                      })
                    }
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() =>
                    setEditing((p) => ({
                      ...p,
                      [item.id]: item.budgetedAmount ?? "",
                    }))
                  }
                  className="text-xs text-right w-full text-gray-700 hover:text-green-700 tabular-nums"
                >
                  {item.budgetedAmount
                    ? `UGX ${Number(item.budgetedAmount).toLocaleString("en-UG")}`
                    : <span className="text-gray-300">— click to set —</span>}
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
