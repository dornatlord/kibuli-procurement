import { SpinnerIcon } from "./icons";

// Row widths vary a little so the placeholder reads as a list, not a grid.
const WIDTHS = ["58%", "44%", "66%", "50%", "38%", "62%", "47%", "55%"];

/** Placeholder rows shaped like the list that will replace them. */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div role="status" className="divide-y divide-gray-100">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} aria-hidden="true" className="flex items-center gap-6 px-4 py-4">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 animate-pulse rounded bg-gray-200/70" style={{ width: WIDTHS[i % WIDTHS.length] }} />
            <div className="h-2.5 w-28 animate-pulse rounded bg-gray-100" />
          </div>
          <div className="hidden h-3 w-24 animate-pulse rounded bg-gray-100 md:block" />
          <div className="h-5 w-20 animate-pulse rounded-full bg-gray-100" />
        </div>
      ))}
    </div>
  );
}

/** A whole page waiting for its data. */
export function PageLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-sm text-gray-500">
      <SpinnerIcon className="h-6 w-6 text-green-700" />
      {label}
    </div>
  );
}
