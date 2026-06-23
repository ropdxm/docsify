import "server-only";

const GOSZAKUPKI_HOST = "https://ows.goszakup.gov.kz";

export type GoszakupkiImportedItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  unit?: string;
};

export type GoszakupkiImportedDocument = {
  contractId: number;
  contractNumber: string;
  contractNumberSys: string;
  contractDate: string | null;
  sourceLabel: string;
  client: {
    bin: string;
    name: string;
    director: string;
    address: string;
  };
  items: GoszakupkiImportedItem[];
  warnings: string[];
};

type JsonObject = Record<string, unknown>;

type ListResponse<T> = {
  total?: number;
  items?: T[];
};

type GoszakupkiContractSummary = {
  id?: number | string;
};

type GoszakupkiContract = GoszakupkiContractSummary & {
  contract_number?: string | number | null;
  contract_number_sys?: string | null;
  trd_buy_number_anno?: string | null;
  supplier_biin?: string | number | null;
  customer_bin?: string | number | null;
  supplier_legal_address?: string | null;
  customer_legal_address?: string | null;
  contract_sum?: string | number | null;
  contract_sum_wnds?: string | number | null;
  sign_date?: string | null;
  description_ru?: string | null;
  description_kz?: string | null;
  deleted?: string | number | null;
};

type GoszakupkiContractUnit = {
  id?: number | string;
  item_price?: string | number | null;
  item_price_wnds?: string | number | null;
  quantity?: string | number | null;
  total_sum?: string | number | null;
  total_sum_wnds?: string | number | null;
  deleted?: string | number | null;
};

type GoszakupkiSubject = {
  bin?: string | null;
  iin?: string | null;
  name_ru?: string | null;
  full_name_ru?: string | null;
  parent_name_ru?: string | null;
  address?: Array<{
    address?: string | null;
    address_type?: string | number | null;
  }>;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numeric(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const parsed = Number(value.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function firstIsoDate(value: unknown): string | null {
  const raw = text(value);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function biin(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "").slice(0, 12);
}

function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isContract(value: unknown): value is GoszakupkiContract {
  return isRecord(value) && value.id !== undefined;
}

async function goszakupkiFetch<T>(
  path: string,
  params?: Record<string, string>
): Promise<T | null> {
  const token = process.env.GOSZAKUPKI_API_TOKEN;
  if (!token) throw new Error("GOSZAKUPKI_API_TOKEN не настроен в .env");

  const url = new URL(path, GOSZAKUPKI_HOST);
  for (const [key, value] of Object.entries(params ?? {})) {
    url.searchParams.set(key, value);
  }

  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Госзакупки вернули HTTP ${res.status}`);
  }

  return (await res.json()) as T;
}

async function contractById(id: string): Promise<GoszakupkiContract | null> {
  const data = await goszakupkiFetch<unknown>(`/v3/contract/${id}`);
  return isContract(data) ? data : null;
}

async function contractByNumber(number: string): Promise<GoszakupkiContract | null> {
  const data = await goszakupkiFetch<unknown>("/v3/contract/number/", {
    number,
  });
  return isContract(data) ? data : null;
}

async function contractBySystemNumber(
  number: string
): Promise<GoszakupkiContract | null> {
  const data = await goszakupkiFetch<unknown>("/v3/contract/number-sys/", {
    number,
  });
  return isContract(data) ? data : null;
}

async function contractByAnnouncement(
  number: string
): Promise<GoszakupkiContract | null> {
  const data = await goszakupkiFetch<ListResponse<GoszakupkiContractSummary>>(
    `/v3/contract/number-anno/${encodeURIComponent(number)}`
  );
  const id = data?.items?.[0]?.id;
  return id ? contractById(String(id)) : null;
}

async function resolveContract(query: string): Promise<GoszakupkiContract | null> {
  const value = query.trim();
  if (!value) return null;

  if (value.includes("/")) return contractBySystemNumber(value);
  if (/^\d+-\d+$/.test(value)) return contractByAnnouncement(value);
  if (/^\d+$/.test(value)) {
    return (await contractById(value)) ?? contractByNumber(value);
  }
  return contractByNumber(value);
}

async function contractUnits(id: number): Promise<GoszakupkiContractUnit[]> {
  const data = await goszakupkiFetch<ListResponse<GoszakupkiContractUnit>>(
    `/v3/contract/${id}/units`
  );
  return data?.items ?? [];
}

async function subjectByBiin(code: string): Promise<GoszakupkiSubject | null> {
  if (!/^\d{12}$/.test(code)) return null;
  const data = await goszakupkiFetch<unknown>(`/v3/subject/biin/${code}`);
  return isRecord(data) ? (data as GoszakupkiSubject) : null;
}

function subjectName(subject: GoszakupkiSubject | null): string {
  if (!subject) return "";
  return (
    text(subject.full_name_ru) ||
    text(subject.name_ru) ||
    text(subject.parent_name_ru)
  );
}

function subjectAddress(subject: GoszakupkiSubject | null): string {
  const addresses = subject?.address ?? [];
  const legal =
    addresses.find((row) => String(row.address_type ?? "") === "1") ??
    addresses[0];
  return text(legal?.address);
}

function unitPrice(unit: GoszakupkiContractUnit): number {
  const quantity = numeric(unit.quantity) ?? 1;
  const direct = numeric(unit.item_price_wnds) ?? numeric(unit.item_price);
  if (direct !== null) return direct;
  const total = numeric(unit.total_sum_wnds) ?? numeric(unit.total_sum);
  return total !== null && quantity > 0 ? total / quantity : 0;
}

function buildItems(
  contract: GoszakupkiContract,
  units: GoszakupkiContractUnit[]
): GoszakupkiImportedItem[] {
  const description =
    text(contract.description_ru) ||
    text(contract.description_kz) ||
    `Договор ${text(contract.contract_number_sys) || text(contract.contract_number)}`;

  const mapped = units
    .map((unit) => {
      const quantity = numeric(unit.quantity) ?? 1;
      const price = unitPrice(unit);
      return {
        description:
          units.length > 1 && unit.id
            ? `${description} (${unit.id})`
            : description,
        quantity,
        unitPrice: price,
        unit: "услуга",
      };
    })
    .filter((item) => item.quantity > 0 && item.unitPrice > 0);

  if (mapped.length > 0) return mapped;

  const amount =
    numeric(contract.contract_sum_wnds) ?? numeric(contract.contract_sum) ?? 0;
  return [
    {
      description,
      quantity: 1,
      unitPrice: amount,
      unit: "услуга",
    },
  ];
}

export async function importGoszakupkiContract(
  query: string,
  companyBin: string
): Promise<GoszakupkiImportedDocument | null> {
  const contract = await resolveContract(query);
  if (!contract) return null;

  const contractId = numeric(contract.id);
  if (!contractId) return null;

  const supplierBin = biin(contract.supplier_biin);
  const customerBin = biin(contract.customer_bin);
  const companyCode = biin(companyBin);

  const clientRole =
    companyCode && companyCode === customerBin ? "supplier" : "customer";
  const clientBin = clientRole === "supplier" ? supplierBin : customerBin;
  const clientLegalAddress =
    clientRole === "supplier"
      ? text(contract.supplier_legal_address)
      : text(contract.customer_legal_address);

  const [subject, units] = await Promise.all([
    subjectByBiin(clientBin),
    contractUnits(contractId),
  ]);

  const warnings: string[] = [];
  if (companyCode && companyCode !== supplierBin && companyCode !== customerBin) {
    warnings.push(
      "БИН вашей компании не совпал со сторонами договора. Проверьте клиента перед отправкой."
    );
  }
  if (!clientBin) {
    warnings.push("В договоре нет БИН/ИИН контрагента.");
  }

  const clientName =
    subjectName(subject) ||
    (clientRole === "supplier" ? "Поставщик из госзакупок" : "Заказчик из госзакупок");
  const clientAddress = clientLegalAddress || subjectAddress(subject);
  const contractNumber =
    text(contract.contract_number) || text(contract.contract_number_sys);

  return {
    contractId,
    contractNumber,
    contractNumberSys: text(contract.contract_number_sys),
    contractDate: firstIsoDate(contract.sign_date),
    sourceLabel:
      text(contract.contract_number_sys) || contractNumber || String(contractId),
    client: {
      bin: clientBin,
      name: clientName,
      director: "",
      address: clientAddress,
    },
    items: buildItems(contract, units),
    warnings,
  };
}
