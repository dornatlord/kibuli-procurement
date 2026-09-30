import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { lpoNumber } from "../lib/forms/lpoForms";
import { yearOf } from "../lib/years";
import PageHeader from "../components/PageHeader";
import { statusLabel } from "../components/Badge";
import { SearchIcon, SpinnerIcon } from "../components/icons";

interface Results {
  requests?: { id: number; referenceNumber: string; subject: string | null; status: string; year: number; size: string; total: string | null }[];
  lpos?: { id: number; poNumber: string; year: number; status: string; total: string | null; supplierName: string | null; referenceNumber: string | null }[];
  contracts?: { id: number; contractNumber: string; title: string; status: string; value: string | null; signedDate: string | null; createdAt: string | null; supplierName: string | null }[];
  suppliers?: { id: number; name: string; phone: string | null; isActive: boolean; years: number[] }[];
  invoices?: { id: number; invoiceNumber: string; invoiceDate: string; amount: string; status: string; supplierName: string | null }[];
  deliveries?: { id: number; grnNumber: string; receivedDate: string; status: string; supplierName: string | null }[];
  disposals?: { id: number; referenceNumber: string; subject: string; buyerName: string | null; awardDate: string | null; contractPrice: string | null }[];
  returns?: { year: number; term: number; part: string; row: Record<string, string> }[];
}

/** Results per kind of record the server sends back at most. */
const LIMIT = 15;
const PARTS: Record<string, string> = {
  partI: "Part I, contracts",
  partII: "Part II, amendments",
  partIII: "Part III, completed",
  partIV: "Part IV, micro purchases",
  partV: "Part V, disposals",
};
const money = (v: string | null | undefined) => (v && Number(v) ? `UGX ${Number(v).toLocaleString("en-UG")}` : "");

/** One search across every year: requests, LPOs, contracts, suppliers and the rest. */
export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const [text, setText] = useState(params.get("q") ?? "");
  const [results, setResults] = useState<Results | null>(null);
  const [searched, setSearched] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const latest = useRef(0);

  // Search a moment after the typing stops; a slower earlier answer can't overwrite a later one.
  useEffect(() => {
    const q = text.trim();
    const timer = window.setTimeout(() => {
      setParams(q ? { q } : {}, { replace: true });
      if (q.length < 2) {
        setResults(null);
        setSearched("");
        return;
      }
      const ticket = ++latest.current;
      setLoading(true);
      setError("");
      api
        .get<{ q: string; results: Results }>(`/search?q=${encodeURIComponent(q)}`)
        .then((r) => {
          if (ticket !== latest.current) return;
          setResults(r.results);
          setSearched(q);
        })
        .catch((e) => ticket === latest.current && setError(e instanceof Error ? e.message : "Search failed"))
        .finally(() => ticket === latest.current && setLoading(false));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [text]);

  const total = results ? Object.values(results).reduce((n, rows) => n + (rows?.length ?? 0), 0) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Search"
        subtitle="Looks through every year at once: request references, subjects and items, LPO numbers (3, or 3/2025), suppliers, contracts, invoices, deliveries, disposals and saved FORM 27 returns."
      />

      <div className="relative max-w-2xl">
        <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Search, e.g. KSS/SUPLS/26/017, beds, Josba, 3/2026"
          aria-label="Search every year"
          autoFocus
          className="input h-12 pl-11 pr-10 text-base"
        />
        {loading && <SpinnerIcon className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />}
      </div>

      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {results && total === 0 && !loading && (
        <div className="card px-6 py-12 text-center">
          <p className="text-sm font-medium text-gray-900">Nothing found for “{searched}” in any year</p>
          <p className="mt-1 text-sm text-gray-500">Try fewer letters, part of a reference, or a supplier's name.</p>
        </div>
      )}

      {results && total > 0 && (
        <div className="space-y-5">
          <Group title="Requests" rows={results.requests}>
            {(r) => (
              <Hit
                key={r.id}
                to={`/requests/${r.id}`}
                title={r.referenceNumber}
                detail={r.subject ?? ""}
                year={r.year}
                meta={[statusLabel(r.status), r.size === "micro" ? "Micro" : "Macro", money(r.total)]}
              />
            )}
          </Group>
          <Group title="LPOs" rows={results.lpos}>
            {(p) => (
              <Hit
                key={p.id}
                to={`/purchase-orders/${p.id}`}
                title={`LPO ${lpoNumber(p)}`}
                detail={p.supplierName ?? ""}
                year={p.year}
                meta={[statusLabel(p.status), p.referenceNumber ?? "", money(p.total)]}
              />
            )}
          </Group>
          <Group title="Contracts" rows={results.contracts}>
            {(c) => (
              <Hit
                key={c.id}
                to={`/contracts/${c.id}`}
                title={c.contractNumber}
                detail={[c.title, c.supplierName].filter(Boolean).join(" · ")}
                year={yearOf(c.signedDate) ?? yearOf(c.createdAt)}
                meta={[statusLabel(c.status), money(c.value)]}
              />
            )}
          </Group>
          <Group title="Suppliers" rows={results.suppliers}>
            {(s) => (
              <Hit
                key={s.id}
                to="/suppliers"
                title={s.name}
                detail={s.phone ?? ""}
                meta={[s.years.length ? `On the list for ${s.years.join(", ")}` : "On no year's list", s.isActive ? "" : "Deactivated"]}
              />
            )}
          </Group>
          <Group title="Invoices" rows={results.invoices}>
            {(i) => (
              <Hit
                key={i.id}
                to="/invoices"
                title={`Invoice ${i.invoiceNumber}`}
                detail={i.supplierName ?? ""}
                year={yearOf(i.invoiceDate)}
                meta={[statusLabel(i.status), money(i.amount)]}
              />
            )}
          </Group>
          <Group title="Goods received" rows={results.deliveries}>
            {(d) => (
              <Hit
                key={d.id}
                to={`/goods-received/${d.id}`}
                title={d.grnNumber}
                detail={d.supplierName ?? ""}
                year={yearOf(d.receivedDate)}
                meta={[statusLabel(d.status)]}
              />
            )}
          </Group>
          <Group title="Disposals" rows={results.disposals}>
            {(d) => (
              <Hit
                key={d.id}
                to="/disposals"
                title={d.referenceNumber}
                detail={[d.subject, d.buyerName].filter(Boolean).join(" · ")}
                year={yearOf(d.awardDate)}
                meta={[money(d.contractPrice)]}
              />
            )}
          </Group>
          <Group title="Saved FORM 27 returns" rows={results.returns}>
            {(r, i) => (
              <Hit
                key={`${r.year}-${r.term}-${r.part}-${i}`}
                to={`/reports/termly?year=${r.year}&term=${r.term}`}
                title={r.row.reference || r.row.subject || "Row"}
                detail={[r.row.subject, r.row.provider || r.row.buyer].filter(Boolean).join(" · ")}
                year={r.year}
                meta={[`Term ${r.term}`, PARTS[r.part] ?? r.part, money(r.row.contractValue || r.row.contractPrice || r.row.amountPaid)]}
              />
            )}
          </Group>
        </div>
      )}
    </div>
  );
}

function Group<T>({ title, rows, children }: { title: string; rows?: T[]; children: (row: T, index: number) => ReactNode }) {
  if (!rows?.length) return null;
  return (
    <section className="card overflow-hidden" aria-label={title}>
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/80 px-4 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-600">{title}</h2>
        <span className="text-xs text-gray-500">
          {rows.length >= LIMIT ? `First ${LIMIT}: add more words to narrow it` : `${rows.length} found`}
        </span>
      </div>
      <ul className="divide-y divide-gray-100">{rows.map((row, i) => children(row, i))}</ul>
    </section>
  );
}

function Hit({ to, title, detail, year, meta }: { to: string; title: string; detail: string; year?: number | null; meta: string[] }) {
  return (
    <li>
      <Link to={to} className="flex items-start gap-3 px-4 py-3 transition hover:bg-gray-50">
        {year ? (
          <span className="mt-0.5 shrink-0 rounded-md bg-green-50 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-green-800">{year}</span>
        ) : null}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-gray-900">{title}</span>
          {detail && <span className="block truncate text-sm text-gray-600">{detail}</span>}
          <span className="mt-0.5 block text-xs text-gray-500">{meta.filter(Boolean).join(" · ")}</span>
        </span>
      </Link>
    </li>
  );
}
