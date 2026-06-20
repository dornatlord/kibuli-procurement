const colors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  pending_hod: "bg-amber-100 text-amber-800",
  pending_accounting_officer: "bg-amber-100 text-amber-800",
  pending_contracts_committee: "bg-amber-100 text-amber-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

const labels: Record<string, string> = {
  draft: "Draft",
  pending_hod: "Pending HoD",
  pending_accounting_officer: "Pending AO",
  pending_contracts_committee: "Pending Committee",
  approved: "Approved",
  rejected: "Rejected",
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${colors[status] ?? "bg-gray-100 text-gray-700"}`}>
      {labels[status] ?? status}
    </span>
  );
}
