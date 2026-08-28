const PALETTE: Record<string, string> = {
  gray: "bg-gray-100 text-gray-700",
  amber: "bg-amber-100 text-amber-800",
  green: "bg-green-100 text-green-800",
  red: "bg-red-100 text-red-800",
  blue: "bg-blue-100 text-blue-800",
  purple: "bg-purple-100 text-purple-800",
};

/** Generic pill badge — pass a tone from PALETTE and the label to show. */
export default function Badge({ tone, label }: { tone: keyof typeof PALETTE; label: string }) {
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${PALETTE[tone] ?? PALETTE.gray}`}>
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
