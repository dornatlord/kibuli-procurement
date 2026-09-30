/** A labelled year picker; with `allowAll`, "All years" comes last. */
export default function YearSelect({
  id,
  value,
  years,
  onChange,
  allowAll = false,
  label = "Year",
}: {
  id: string;
  value: number | "all";
  years: number[];
  onChange: (year: number | "all") => void;
  allowAll?: boolean;
  label?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <select
        id={id}
        className="input w-36"
        value={value}
        onChange={(e) => onChange(e.target.value === "all" ? "all" : Number(e.target.value))}
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
        {allowAll && <option value="all">All years</option>}
      </select>
    </div>
  );
}
