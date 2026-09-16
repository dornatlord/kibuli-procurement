const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function belowThousand(n: number) {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds) parts.push(`${ONES[hundreds]} Hundred`);
  if (rest) {
    const words = rest < 20 ? ONES[rest] : `${TENS[Math.floor(rest / 10)]}${rest % 10 ? `-${ONES[rest % 10]}` : ""}`;
    parts.push(hundreds ? `and ${words}` : words);
  }
  return parts.join(" ");
}

/** 4075000 → "Four Million Seventy-Five Thousand Shillings Only", for "Amount in words". */
export function shillingsInWords(amount: number) {
  const n = Math.round(Math.abs(amount));
  if (n === 0) return "Zero Shillings Only";
  const scales: [string, number][] = [
    ["Billion", 1e9],
    ["Million", 1e6],
    ["Thousand", 1e3],
    ["", 1],
  ];
  let rest = n;
  const parts: string[] = [];
  for (const [name, size] of scales) {
    const chunk = Math.floor(rest / size);
    rest %= size;
    if (chunk) parts.push(name ? `${belowThousand(chunk)} ${name}` : belowThousand(chunk));
  }
  return `${parts.join(" ")} Shillings Only`;
}
