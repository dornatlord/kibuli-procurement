import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { thisYear, yearChoices } from "../lib/years";
import PageHeader from "../components/PageHeader";
import YearSelect from "../components/YearSelect";
import { PageLoading } from "../components/Loading";

interface Vote { id: number; code: string; name: string; }
interface SubProgramme { id: number; voteId: number; romanNumeral: string | null; name: string; }
interface BudgetItem { id: number; voteId: number; subProgrammeId: number | null; name: string; amount: string | null; }
interface Budget { year: number; years: number[]; votes: Vote[]; subProgrammes: SubProgramme[]; items: BudgetItem[]; }

const money = (v: string | number) => Number(v).toLocaleString("en-UG");
const sumOf = (items: BudgetItem[]) => items.reduce((s, i) => s + Number(i.amount || 0), 0);

/** The school's budget, one year at a time: each year keeps its own amounts. */
export default function BudgetAdminPage() {
  const { can } = useAuth();
  const allowed = can("budget.edit");
  const [year, setYear] = useState(thisYear());
  const [budget, setBudget] = useState<Budget | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    api
      .get<Budget>(`/budget?year=${year}`)
      .then((b) => !cancelled && setBudget(b))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Could not load the budget"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [year, allowed]);

  if (!allowed) return <Navigate to="/dashboard" replace />;

  async function save(itemId: number) {
    setSaving((p) => ({ ...p, [itemId]: true }));
    setError("");
    try {
      const res = await api.put<{ amount: string | null }>(`/budget/amounts/${itemId}`, { year, amount: editing[itemId] });
      setBudget((b) => b && { ...b, items: b.items.map((i) => (i.id === itemId ? { ...i, amount: res.amount } : i)) });
      setEditing((p) => {
        const n = { ...p };
        delete n[itemId];
        return n;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the amount");
    } finally {
      setSaving((p) => ({ ...p, [itemId]: false }));
    }
  }

  // The latest earlier year with a budget, to start this one from.
  const earlier = budget?.years.filter((y) => y < year).sort((a, b) => b - a)[0];
  const empty = !!budget && budget.items.every((i) => !i.amount);

  async function copyFrom(from: number) {
    setCopying(true);
    setError("");
    try {
      await api.post("/budget/copy", { from, to: year });
      setBudget(await api.get<Budget>(`/budget?year=${year}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not copy the budget");
    } finally {
      setCopying(false);
    }
  }

  const years = yearChoices(budget?.years ?? [], thisYear() + 1);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Budget"
        subtitle="Each year keeps its own amounts, so setting next year's never changes this year's. Confidential: for the Accounting Officer and Head Teacher."
      />

      <div className="card flex flex-wrap items-end justify-between gap-4 p-4">
        <YearSelect id="budget-year" value={year} years={years} onChange={(y) => y !== "all" && setYear(y)} />
        {budget && (
          <div className="text-right">
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{year} budget</div>
            <div className="text-xl font-semibold tabular-nums text-gray-900">UGX {money(sumOf(budget.items))}</div>
          </div>
        )}
      </div>

      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {loading || !budget ? (
        <PageLoading />
      ) : (
        <>
          {empty && (
            <div className="card flex flex-wrap items-center justify-between gap-3 border-amber-200 bg-amber-50 px-5 py-4">
              <p className="text-sm text-amber-900">
                No amounts for {year} yet.{" "}
                {earlier ? `Start from ${earlier}'s and change what's different, or type each one.` : "Click an amount to set it."}
              </p>
              {earlier && (
                <button type="button" onClick={() => copyFrom(earlier)} disabled={copying} className="btn btn-primary btn-sm">
                  {copying ? "Copying…" : `Copy ${earlier}'s amounts`}
                </button>
              )}
            </div>
          )}

          {budget.votes.map((v) => {
            const voteItems = budget.items.filter((i) => i.voteId === v.id);
            const subs = budget.subProgrammes.filter((s) => s.voteId === v.id);
            return (
              <div key={v.id} className="card overflow-hidden">
                <div className="flex items-center justify-between gap-3 bg-green-800 px-4 py-2 text-sm font-semibold text-white">
                  <span>
                    {v.code} — {v.name}
                  </span>
                  <span className="tabular-nums text-green-100">{money(sumOf(voteItems))}</span>
                </div>
                {subs.length === 0 ? (
                  <ItemsTable items={voteItems} editing={editing} saving={saving} setEditing={setEditing} save={save} />
                ) : (
                  subs.map((sp) => (
                    <div key={sp.id}>
                      <div className="border-b border-gray-100 bg-gray-50 px-4 py-1.5 text-xs font-semibold text-gray-600">
                        {sp.romanNumeral ? `${sp.romanNumeral} ` : ""}
                        {sp.name}
                      </div>
                      <ItemsTable
                        items={voteItems.filter((i) => i.subProgrammeId === sp.id)}
                        editing={editing}
                        saving={saving}
                        setEditing={setEditing}
                        save={save}
                      />
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </>
      )}
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
  if (items.length === 0) return <div className="px-4 py-2 text-xs italic text-gray-400">No items</div>;
  return (
    <table className="w-full text-sm">
      <tbody className="divide-y divide-gray-50">
        {items.map((item) => (
          <tr key={item.id} className="hover:bg-gray-50">
            <td className="px-4 py-2">{item.name}</td>
            <td className="w-56 px-4 py-2">
              {item.id in editing ? (
                <form
                  className="flex items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    save(item.id);
                  }}
                >
                  <input
                    type="number"
                    value={editing[item.id]}
                    onChange={(e) => setEditing((p) => ({ ...p, [item.id]: e.target.value }))}
                    className="w-32 rounded border border-gray-300 px-2 py-1 text-right text-xs"
                    min="0"
                    step="1"
                    aria-label={`Amount for ${item.name}`}
                    autoFocus
                  />
                  <button type="submit" disabled={saving[item.id]} className="text-xs font-medium text-green-700 hover:underline">
                    Save
                  </button>
                  <button
                    type="button"
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
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditing((p) => ({ ...p, [item.id]: item.amount ? String(Number(item.amount)) : "" }))}
                  className="w-full text-right text-xs tabular-nums text-gray-700 hover:text-green-700"
                >
                  {item.amount ? `UGX ${money(item.amount)}` : <span className="text-gray-300">— click to set —</span>}
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
