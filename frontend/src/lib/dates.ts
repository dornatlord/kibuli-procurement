/** "today at 14:32", "yesterday at 09:05", "12 Sept at 16:40". */
export function when(time: number | string) {
  const date = new Date(time);
  const clock = date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(time).setHours(0, 0, 0, 0)) / 86400000);
  if (days === 0) return `today at ${clock}`;
  if (days === 1) return `yesterday at ${clock}`;
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return `${date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: sameYear ? undefined : "numeric" })} at ${clock}`;
}

/** "20 June 2026". */
export const longDate = (time: string) =>
  new Date(time).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
