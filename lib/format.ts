// Kazakhstan formatting conventions: amounts grouped by spaces with the ₸ sign,
// dates as DD.MM.YYYY.

/** Parse a loosely-typed amount string ("1 200,50") into a number. */
export function num(input: string | number): number {
  if (typeof input === "number") return Number.isFinite(input) ? input : 0;
  const n = parseFloat(input.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/** "1 250 000 ₸" */
export function formatTenge(amount: number): string {
  return `${new Intl.NumberFormat("ru-RU").format(Math.round(amount))} ₸`;
}

/** "09.06.2026" */
export function formatDateRu(date: Date): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}
