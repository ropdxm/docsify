// Seed N fully-onboarded demo users into Supabase.
//
// Each "user" = an auth.users account (Admin API, so the password is hashed
// correctly) + one public.companies row with a completed profile + a 7-day
// Pro trial subscription (mirrors ensureTrialSubscription at signup).
//
// Usage:
//   node --env-file=.env scripts/seed-users.mjs [count]
// count defaults to 50.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- env: prefer process.env (via --env-file), fall back to parsing .env -----
function loadEnv() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return;
  }
  const raw = readFileSync(join(__dirname, "..", ".env"), "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const COUNT = Number(process.argv[2] ?? 50);
const PASSWORD = "Docsify123!"; // shared demo password
const TRIAL_DAYS = 7;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// --- fake Kazakh business data ----------------------------------------------
const firstNames = [
  "Айгерим", "Нуржан", "Данияр", "Асель", "Ерлан", "Мадина", "Тимур", "Гульнара",
  "Азамат", "Динара", "Бахыт", "Жанна", "Руслан", "Салтанат", "Канат", "Айнур",
  "Марат", "Алия", "Дамир", "Камила", "Нурлан", "Жанар", "Серик", "Аружан",
  "Бекзат", "Меруерт", "Олжас", "Дана", "Санжар", "Лаура",
];
const lastNames = [
  "Ахметов", "Оспанов", "Сериков", "Нуркенов", "Абдиров", "Есенов", "Калиев",
  "Смагулов", "Жумабеков", "Токаев", "Байжанов", "Дюсенов", "Мукашев", "Оразбаев",
  "Сапаров", "Тлеубаев", "Утегенов", "Каримов", "Бекова", "Сатыбалдиева",
];
const cities = [
  "Алматы", "Астана", "Шымкент", "Караганда", "Актобе", "Тараз", "Павлодар",
  "Усть-Каменогорск", "Семей", "Атырау", "Костанай", "Кызылорда",
];
const streets = [
  "ул. Абая", "пр. Достык", "ул. Сатпаева", "пр. Аль-Фараби", "ул. Толе би",
  "ул. Жандосова", "пр. Назарбаева", "ул. Гоголя", "ул. Байтурсынова",
];
const bizForms = ["ИП", "ТОО"];
const bizNouns = [
  "Строй", "Транс", "Агро", "Тех", "Мед", "Логистик", "Трейд", "Сервис",
  "Групп", "Пром", "Консалтинг", "Дизайн", "Медиа", "Фуд", "Инжиниринг",
];
const bizSuffix = ["KZ", "Астана", "Central Asia", "Company", "Partners", "Group", ""];

const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const digits = (n) =>
  Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join("");
const romanize = (s) =>
  s.toLowerCase().split("").map((ch) => (
    ({ а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"e",ж:"zh",з:"z",и:"i",й:"i",к:"k",
       л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"h",ц:"c",
       ч:"ch",ш:"sh",щ:"sch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya" })[ch] ?? ch
  )).join("").replace(/[^a-z0-9]/g, "");

const runTag = Date.now().toString(36); // unique per run, avoids email collisions

async function main() {
  console.log(`Seeding ${COUNT} users into ${SUPABASE_URL} ...\n`);
  let ok = 0;
  const failures = [];

  for (let i = 0; i < COUNT; i++) {
    const first = rand(firstNames);
    const last = rand(lastNames);
    const email = `${romanize(first)}.${romanize(last)}.${runTag}${i}@example.com`;
    const director = `${first} ${last}`;
    const form = rand(bizForms);
    const companyName =
      form === "ИП"
        ? `ИП «${last}»`
        : `ТОО «${rand(bizNouns)}${rand(bizSuffix) ? " " + rand(bizSuffix) : ""}»`;
    const bin = digits(12);
    const address = `${rand(cities)}, ${rand(streets)}, ${1 + Math.floor(Math.random() * 200)}`;

    try {
      // 1) auth user
      const { data: userRes, error: userErr } = await admin.auth.admin.createUser({
        email,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { seeded: true, full_name: director },
      });
      if (userErr) throw new Error(`auth: ${userErr.message}`);
      const userId = userRes.user.id;

      // 2) company (completed profile)
      const { data: company, error: coErr } = await admin
        .from("companies")
        .insert({
          owner_id: userId,
          bin,
          name: companyName,
          director,
          address,
          is_profile_complete: true,
        })
        .select("id")
        .single();
      if (coErr) throw new Error(`company: ${coErr.message}`);

      // 3) 7-day Pro trial subscription
      const trialEnds = new Date();
      trialEnds.setDate(trialEnds.getDate() + TRIAL_DAYS);
      const { error: subErr } = await admin.from("subscriptions").upsert(
        {
          company_id: company.id,
          plan: "pro",
          status: "trialing",
          trial_ends_at: trialEnds.toISOString(),
        },
        { onConflict: "company_id", ignoreDuplicates: true }
      );
      if (subErr) throw new Error(`subscription: ${subErr.message}`);

      ok++;
      console.log(`  ✓ ${String(i + 1).padStart(2)}/${COUNT}  ${email}  —  ${companyName}`);
    } catch (e) {
      failures.push({ email, error: e.message });
      console.log(`  ✗ ${String(i + 1).padStart(2)}/${COUNT}  ${email}  —  ${e.message}`);
    }
  }

  console.log(`\nDone. ${ok}/${COUNT} users created. Shared password: ${PASSWORD}`);
  if (failures.length) {
    console.log(`${failures.length} failed:`);
    for (const f of failures) console.log(`  - ${f.email}: ${f.error}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
