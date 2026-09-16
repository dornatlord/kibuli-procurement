import Badge, { PALETTE } from "./Badge";

const tones: Record<string, keyof typeof PALETTE> = {
  draft: "gray",
  pending_hod: "amber",
  pending_accounting_officer: "amber",
  pending_contracts_committee: "amber",
  approved: "green",
  rejected: "red",
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
  return <Badge tone={tones[status] ?? "gray"} label={labels[status] ?? status} />;
}
