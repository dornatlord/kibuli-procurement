/** The school's mark: a "K" monogram in the brand green. */
export default function BrandMark({
  size = "md",
  tone = "brand",
}: {
  size?: "sm" | "md";
  /** "light" sits on the dark green sidebar and brand panel. */
  tone?: "brand" | "light";
}) {
  const sizes = {
    sm: "h-8 w-8 rounded-lg text-sm",
    md: "h-10 w-10 rounded-xl text-base",
  };
  const tones = {
    brand: "bg-green-700 text-white ring-black/5",
    light: "bg-white text-green-800 ring-white/20",
  };
  return (
    <span
      aria-hidden="true"
      className={`inline-grid shrink-0 place-items-center font-bold tracking-tight shadow-sm ring-1 ring-inset ${sizes[size]} ${tones[tone]}`}
    >
      K
    </span>
  );
}
