import { KSS_BADGE } from "../lib/badge";

/** The school badge on a white tile, so it reads on the green sidebar and on white pages alike. */
export default function BrandMark({ size = "md" }: { size?: "sm" | "md"; tone?: "brand" | "light" }) {
  const sizes = {
    sm: "h-8 w-8 rounded-lg p-1",
    md: "h-10 w-10 rounded-xl p-1",
  };
  return (
    <span
      aria-hidden="true"
      className={`inline-grid shrink-0 place-items-center bg-white shadow-sm ring-1 ring-inset ring-black/5 ${sizes[size]}`}
    >
      <img src={KSS_BADGE} alt="" className="h-full w-full object-contain" />
    </span>
  );
}
