/** Pill colours: a tinted fill, a hairline ring and a status dot. */
export const PALETTE = {
  gray: { pill: "bg-gray-50 text-gray-700 ring-gray-500/20", dot: "bg-gray-400" },
  amber: { pill: "bg-amber-50 text-amber-800 ring-amber-600/20", dot: "bg-amber-500" },
  green: { pill: "bg-green-50 text-green-800 ring-green-600/20", dot: "bg-green-600" },
  red: { pill: "bg-red-50 text-red-700 ring-red-600/20", dot: "bg-red-500" },
  blue: { pill: "bg-blue-50 text-blue-700 ring-blue-600/20", dot: "bg-blue-500" },
  purple: { pill: "bg-purple-50 text-purple-700 ring-purple-600/20", dot: "bg-purple-500" },
};

/** Generic pill badge — pass a tone from PALETTE and the label to show. */
export default function Badge({ tone, label }: { tone: keyof typeof PALETTE; label: string }) {
  const t = PALETTE[tone] ?? PALETTE.gray;
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${t.pill}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} aria-hidden="true" />
      {label}
    </span>
  );
}

export const STATUS_TONES: Record<string, Record<string, keyof typeof PALETTE>> = {
  po: {
    draft: "gray",
    issued: "blue",
    acknowledged: "amber",
    completed: "green",
    cancelled: "red",
  },
  grn: {
    pending_inspection: "amber",
    accepted: "green",
    rejected: "red",
    partial: "blue",
  },
  invoice: {
    pending: "amber",
    approved: "blue",
    paid: "green",
    rejected: "red",
  },
  contract: {
    draft: "gray",
    active: "blue",
    completed: "green",
    terminated: "red",
  },
  plan: {
    planned: "gray",
    in_progress: "blue",
    completed: "green",
  },
};

export function statusLabel(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
