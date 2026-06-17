import { z } from "zod";

// Shared between server actions ("use server" files may only export async
// functions, so schemas live here).

export const Requisites = z.object({
  bin: z.string().regex(/^\d{12}$/, "БИН/ИИН: ровно 12 цифр"),
  name: z.string().min(2, "Укажите название компании"),
  director: z.string().optional(),
  address: z.string().optional(),
});

// Банковские реквизиты из блока «Платежное поручение» официального счёта.
export const BankRequisites = z.object({
  iik: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^KZ[A-Z0-9]{18}$/, "ИИК: 20 символов, начинается с KZ"),
  bank_name: z.string().trim().min(2, "Укажите название банка"),
  bik: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{8,11}$/, "БИК: 8–11 символов"),
  kbe: z.string().trim().regex(/^\d{2}$/, "Кбе: 2 цифры"),
  knp: z
    .string()
    .trim()
    .regex(/^\d{3}$/, "КНП: 3 цифры")
    .or(z.literal(""))
    .optional(),
});

// Build field errors from issues directly - robust across zod versions.
export function fieldErrorsOf(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string") (out[key] ??= []).push(issue.message);
  }
  return out;
}
