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

const ONES_MASC = [
  "",
  "один",
  "два",
  "три",
  "четыре",
  "пять",
  "шесть",
  "семь",
  "восемь",
  "девять",
];
const ONES_FEM = [
  "",
  "одна",
  "две",
  "три",
  "четыре",
  "пять",
  "шесть",
  "семь",
  "восемь",
  "девять",
];
const TEENS = [
  "десять",
  "одиннадцать",
  "двенадцать",
  "тринадцать",
  "четырнадцать",
  "пятнадцать",
  "шестнадцать",
  "семнадцать",
  "восемнадцать",
  "девятнадцать",
];
const TENS = [
  "",
  "",
  "двадцать",
  "тридцать",
  "сорок",
  "пятьдесят",
  "шестьдесят",
  "семьдесят",
  "восемьдесят",
  "девяносто",
];
const HUNDREDS = [
  "",
  "сто",
  "двести",
  "триста",
  "четыреста",
  "пятьсот",
  "шестьсот",
  "семьсот",
  "восемьсот",
  "девятьсот",
];
type BigUnit = {
  forms: [string, string, string];
  feminine: boolean;
};

const BIG_UNITS: BigUnit[] = [
  { forms: ["", "", ""], feminine: false },
  { forms: ["тысяча", "тысячи", "тысяч"], feminine: true },
  { forms: ["миллион", "миллиона", "миллионов"], feminine: false },
  { forms: ["миллиард", "миллиарда", "миллиардов"], feminine: false },
  { forms: ["триллион", "триллиона", "триллионов"], feminine: false },
];

function pluralRu(n: number, forms: [string, string, string]): string {
  const n100 = Math.abs(n) % 100;
  const n10 = n100 % 10;
  if (n100 >= 11 && n100 <= 14) return forms[2];
  if (n10 === 1) return forms[0];
  if (n10 >= 2 && n10 <= 4) return forms[1];
  return forms[2];
}

function chunkToWords(n: number, feminine: boolean): string[] {
  const words: string[] = [];
  const hundreds = Math.floor(n / 100);
  const tensAndOnes = n % 100;
  const tens = Math.floor(tensAndOnes / 10);
  const ones = tensAndOnes % 10;

  if (hundreds) words.push(HUNDREDS[hundreds]);
  if (tensAndOnes >= 10 && tensAndOnes <= 19) {
    words.push(TEENS[tensAndOnes - 10]);
  } else {
    if (tens) words.push(TENS[tens]);
    if (ones) words.push((feminine ? ONES_FEM : ONES_MASC)[ones]);
  }

  return words;
}

function integerToRussianWords(n: number): string {
  if (n === 0) return "ноль";

  const words: string[] = [];
  let rest = n;
  let unitIndex = 0;

  while (rest > 0 && unitIndex < BIG_UNITS.length) {
    const chunk = rest % 1000;
    const unit = BIG_UNITS[unitIndex];
    if (chunk) {
      const chunkWords = chunkToWords(chunk, unit.feminine);
      if (unitIndex > 0) {
        chunkWords.push(pluralRu(chunk, unit.forms));
      }
      words.unshift(...chunkWords);
    }
    rest = Math.floor(rest / 1000);
    unitIndex += 1;
  }

  return words.join(" ");
}

/** "Шестьдесят две тысячи тенге 00 тиын" */
export function formatTengeWords(amount: number): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const sign = safeAmount < 0 ? "минус " : "";
  const totalTiyn = Math.round(Math.abs(safeAmount) * 100);
  const tenge = Math.floor(totalTiyn / 100);
  const tiyn = totalTiyn % 100;
  const words = `${sign}${integerToRussianWords(tenge)} тенге ${String(tiyn).padStart(2, "0")} тиын`;

  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** "09.06.2026" */
export function formatDateRu(date: Date): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}
