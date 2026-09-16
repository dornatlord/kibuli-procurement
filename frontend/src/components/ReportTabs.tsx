import { Link, useLocation } from "react-router-dom";

const TABS = [
  { to: "/reports/monthly", label: "Monthly", form: "FORM 2" },
  { to: "/reports/termly", label: "Termly", form: "FORM 27" },
];

/** Switch between the monthly and termly PPDA returns — the school reports whichever it needs. */
export default function ReportTabs() {
  const { pathname } = useLocation();
  return (
    <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
      {TABS.map((t) => {
        const active = pathname === t.to;
        return (
          <Link
            key={t.to}
            to={t.to}
            aria-current={active ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              active ? "bg-green-700 text-white shadow-sm" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            }`}
          >
            {t.label}
            <span className={`ml-1.5 text-xs ${active ? "text-green-100" : "text-gray-400"}`}>{t.form}</span>
          </Link>
        );
      })}
    </div>
  );
}
