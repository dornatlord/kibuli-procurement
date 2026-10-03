import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { shortHeading, type ListSection, type PrequalifiedCategory, type PrequalifiedList } from "../lib/suppliers";
import { ListSkeleton } from "./Loading";

/** A budget line as /lookup/budget-lines lists it. */
interface BudgetLine {
  key: string;
  name: string;
  voteCode: string;
  number: number;
}

const SECTIONS: { section: ListSection; title: string; short: string }[] = [
  { section: "supplies", title: "Goods / Supplies", short: "Supplies" },
  { section: "non_consultancy", title: "Non-consultancy services", short: "Services" },
  { section: "works", title: "Works", short: "Works" },
];

/** A category used by more budget lines than this lists the first few, and the rest on request. */
const LINES_SHOWN = 10;

type Filter = "all" | ListSection;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "supplies", label: "Supplies" },
  { value: "non_consultancy", label: "Services" },
  { value: "works", label: "Works" },
];

/** "1–16", or "30" for a section of one category. */
const rangeOf = (cats: PrequalifiedCategory[]) =>
  cats.length === 1 ? String(cats[0].number) : `${cats[0].number}–${cats[cats.length - 1].number}`;

/**
 * A year's pre-qualified list laid out as the school's own: categories
 * numbered straight through Supplies, Services and Works, each with its
 * reference, its headings, its suppliers in the list's order, and the budget
 * lines ("votes") whose requests offer its suppliers.
 */
export default function PrequalifiedView({ year }: { year: number }) {
  const [list, setList] = useState<PrequalifiedList | null>(null);
  const [error, setError] = useState("");
  const [lineNames, setLineNames] = useState<Map<string, string>>(new Map());
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    let live = true;
    setList(null);
    setError("");
    Promise.all([
      api.get<PrequalifiedList>(`/suppliers/prequalified?year=${year}`),
      // The names of the lines each category is offered on. Without them the
      // list still shows, just not which lines use each category.
      api.get<BudgetLine[]>("/lookup/budget-lines").catch(() => [] as BudgetLine[]),
    ])
      .then(([l, lines]) => {
        if (!live) return;
        setLineNames(new Map(lines.map((b) => [b.key, `${b.voteCode}-${b.number} ${b.name}`])));
        setList(l);
      })
      .catch((e) => live && setError(e instanceof Error ? e.message : "Couldn't load the list"));
    return () => {
      live = false;
    };
  }, [year]);

  const q = query.trim().toLowerCase();
  const shown = useMemo(() => {
    if (!list) return [];
    return list.categories
      .filter((c) => filter === "all" || c.section === filter)
      .map((c) => {
        const about = [c.name, c.reference, String(c.number)].join(" ").toLowerCase();
        const members = c.members.filter((m) => {
          if (!q || about.includes(q)) return true;
          const headings = m.groups.map((g) => c.groups[g - 1] ?? "");
          return [m.name, m.printedName, m.phone, m.address, ...headings].some((t) => t?.toLowerCase().includes(q));
        });
        return { ...c, members };
      })
      .filter((c) => c.members.length > 0);
  }, [list, filter, q]);

  if (error) {
    return <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>;
  }
  if (!list) {
    return (
      <div className="card overflow-hidden">
        <ListSkeleton />
      </div>
    );
  }
  if (list.year === null) {
    return (
      <div className="card px-6 py-12 text-center text-sm text-gray-500">
        No pre-qualified list has been entered yet. Once the Contracts Committee's list is in, its categories show here.
      </div>
    );
  }

  const suppliersOnList = new Set(list.categories.flatMap((c) => c.members.map((m) => m.supplierId))).size;
  const entries = shown.reduce((n, c) => n + c.members.length, 0);
  const allEntries = list.categories.reduce((n, c) => n + c.members.length, 0);

  return (
    <div className="space-y-5">
      {list.year !== year && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {year} has no pre-qualified list of its own yet, so the {list.year} list is shown: it stays in use until the
          Contracts Committee approves the next.
        </p>
      )}

      <div className="card flex flex-wrap gap-x-8 gap-y-3 px-5 py-4">
        <Fact value={list.categories.length} label={`categories, numbered 1–${list.categories.length}`} />
        <Fact value={suppliersOnList} label="suppliers on the list" />
        {SECTIONS.map(({ section, short }) => {
          const cats = list.categories.filter((c) => c.section === section);
          return cats.length ? (
            <Fact key={section} value={rangeOf(cats)} label={`${short} ${cats.length === 1 ? "category" : "categories"}`} />
          ) : null;
        })}
      </div>

      <p className="text-sm text-gray-500">
        A request's provider boxes offer the suppliers of the categories its budget line uses (listed under each
        category), so Food expenses offers category 2's. Typing in those boxes still finds any supplier.
      </p>

      <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center gap-3 bg-gray-50/95 px-1 py-2 backdrop-blur">
        <input
          type="search"
          aria-label="Find on the pre-qualified list"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a supplier, phone number, food or service…"
          className="input min-w-0 flex-1 basis-60"
        />
        <div role="group" aria-label="Show" className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={`rounded-full border px-3 py-1 text-sm ${
                filter === f.value
                  ? "border-green-800 bg-green-800 text-white"
                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {entries !== allEntries && (
          <span className="text-sm text-gray-500" aria-live="polite">
            {entries} of {allEntries} entries
          </span>
        )}
      </div>

      {shown.length === 0 ? (
        <div className="card px-6 py-12 text-center text-sm text-gray-400">Nothing matches. Try another name, or show all.</div>
      ) : (
        SECTIONS.map(({ section, title }) => {
          const cats = shown.filter((c) => c.section === section);
          if (!cats.length) return null;
          const all = list.categories.filter((c) => c.section === section);
          return (
            <section key={section} className="space-y-3" aria-label={title}>
              <div className="flex flex-wrap items-baseline gap-x-3 pt-1">
                <h2 className="text-base font-semibold text-gray-900">{title}</h2>
                <span className="text-sm text-gray-500">
                  {all.length === 1 ? "Category" : "Categories"} {rangeOf(all)}
                </span>
              </div>
              {cats.map((c) => (
                <CategoryCard key={c.id} category={c} lineNames={lineNames} />
              ))}
            </section>
          );
        })
      )}
    </div>
  );
}

function Fact({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="grid">
      <b className="text-xl font-semibold tabular-nums text-gray-900">{value}</b>
      <span className="text-xs text-gray-500">{label}</span>
    </div>
  );
}

function CategoryCard({ category: c, lineNames }: { category: PrequalifiedCategory; lineNames: Map<string, string> }) {
  const count = c.members.length;
  const [allLines, setAllLines] = useState(false);
  // In the budget's order: by vote, then by the line's number in it ("2201-31" before "2204-1").
  const place = (key: string) => {
    const m = (lineNames.get(key) ?? "").match(/^(\d+)-(\d+)/);
    return m ? Number(m[1]) * 1000 + Number(m[2]) : Number.MAX_SAFE_INTEGER;
  };
  const ordered = [...c.lines].sort((a, b) => place(a.key) - place(b.key));
  const lines = allLines ? ordered : ordered.slice(0, LINES_SHOWN);
  return (
    <article className="card overflow-hidden" aria-labelledby={`cat-${c.id}`}>
      <header className="flex items-center gap-4 border-b border-gray-200 px-5 py-3.5">
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-green-50 font-semibold tabular-nums text-green-800"
          aria-label={`Category ${c.number}`}
        >
          {c.number}
        </span>
        <div className="min-w-0 flex-1">
          <h3 id={`cat-${c.id}`} className="text-sm font-semibold text-gray-900">
            {c.name}
          </h3>
          {c.reference && <p className="font-mono text-xs text-gray-500">{c.reference}</p>}
        </div>
        <span className="shrink-0 text-xs text-gray-500">
          {count} {count === 1 ? "supplier" : "suppliers"}
        </span>
      </header>

      {c.groups.length > 0 && (
        <p className="border-b border-gray-100 px-5 py-2.5 text-xs text-gray-500">
          Listed under {c.groups.length} headings with this one reference: {c.groups.join(" · ")}.
        </p>
      )}

      {/* Left out when the lines' names couldn't load, rather than show their keys. */}
      {(lineNames.size > 0 || c.lines.length === 0) && (
        <div className="border-b border-gray-100 px-5 py-2.5 text-xs text-gray-500">
          {c.lines.length ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span>Offered on requests for:</span>
              {lines.map((l) => (
                <span key={l.key} className="rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-gray-700">
                  {lineNames.get(l.key) ?? "A budget line"}
                  {l.groups.length > 0 && (
                    <span className="text-gray-400"> · {l.groups.map((g) => c.groups[g - 1]).filter(Boolean).join(", ")}</span>
                  )}
                </span>
              ))}
              {c.lines.length > LINES_SHOWN && (
                <button
                  type="button"
                  aria-expanded={allLines}
                  onClick={() => setAllLines((a) => !a)}
                  className="font-medium text-green-700 hover:text-green-800"
                >
                  {allLines ? "Show fewer" : `and ${c.lines.length - LINES_SHOWN} more`}
                </button>
              )}
            </div>
          ) : (
            "No budget line uses this category yet."
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="bg-gray-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th scope="col" className="px-5 py-2">Supplier</th>
              <th scope="col" className="w-1/4 px-5 py-2">Phone</th>
              <th scope="col" className="w-1/4 px-5 py-2">Address</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {c.members.map((m) => (
              <tr key={m.supplierId} className={m.isActive ? "" : "opacity-50"}>
                <td className="px-5 py-2.5 align-top">
                  <span className="font-medium text-gray-900">{m.name}</span>
                  {!m.isActive && <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700">inactive</span>}
                  {m.printedName && <span className="block text-xs text-gray-500">Printed on the list: {m.printedName}</span>}
                  {m.groups.length > 0 && (
                    <span className="mt-1 flex flex-wrap gap-1">
                      {m.groups.map((g) => (
                        <span key={g} className="rounded border border-gray-200 px-1.5 text-[11px] text-gray-500" title={c.groups[g - 1]}>
                          {shortHeading(c.groups[g - 1] ?? "")}
                        </span>
                      ))}
                    </span>
                  )}
                </td>
                <td className="px-5 py-2.5 align-top tabular-nums text-gray-700">
                  {m.phone ? (
                    m.phone.split(/,\s*/).map((n, i, all) => (
                      <span key={n} className="whitespace-nowrap">
                        {n}
                        {i < all.length - 1 ? ", " : ""}
                      </span>
                    ))
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="px-5 py-2.5 align-top text-gray-700">{m.address || <span className="text-gray-400">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}
