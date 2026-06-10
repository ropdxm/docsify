import path from "node:path";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import { formatTenge, formatDateRu } from "@/lib/format";

// react-pdf's built-in fonts have NO Cyrillic. Register PT Sans (bundled TTFs)
// so Russian text and ₸ render correctly.
Font.register({
  family: "PT Sans",
  fonts: [
    { src: path.join(process.cwd(), "lib", "pdf", "fonts", "PTSans-Regular.ttf") },
    {
      src: path.join(process.cwd(), "lib", "pdf", "fonts", "PTSans-Bold.ttf"),
      fontWeight: 700,
    },
  ],
});
Font.registerHyphenationCallback((word) => [word]); // don't hyphenate

export type PdfDoc = {
  type: "invoice" | "avr";
  number: string;
  date: string;
  items: Array<{ description: string; quantity: number; unitPrice: number }>;
  total_amount: number;
  company: {
    name: string;
    bin: string;
    director?: string | null;
    address?: string | null;
    bank_account?: string | null;
    bank_name?: string | null;
  };
  counterparty: {
    name: string;
    bin: string;
    director?: string | null;
    address?: string | null;
  } | null;
};

const ink = "#211d17";
const faint = "#8a8173";
const line = "#d9d2c5";
const tenge = "#0a5d52";

const s = StyleSheet.create({
  page: {
    fontFamily: "PT Sans",
    fontSize: 9,
    color: ink,
    padding: 40,
    lineHeight: 1.4,
  },
  title: { fontSize: 16, fontWeight: 700 },
  sub: { fontSize: 9, color: faint, marginTop: 2 },
  parties: { flexDirection: "row", gap: 16, marginTop: 22 },
  party: {
    flex: 1,
    borderWidth: 1,
    borderColor: line,
    borderRadius: 6,
    padding: 12,
  },
  partyLabel: {
    fontSize: 7.5,
    color: faint,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  partyName: { fontSize: 10.5, fontWeight: 700, marginBottom: 4 },
  meta: { color: faint, marginTop: 1 },
  tableHead: {
    flexDirection: "row",
    backgroundColor: "#f1ede3",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: line,
    marginTop: 24,
    paddingVertical: 6,
    fontSize: 7.5,
    color: faint,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: line,
    paddingVertical: 7,
  },
  cNum: { width: 22, paddingHorizontal: 4 },
  cDesc: { flex: 1, paddingHorizontal: 4 },
  cQty: { width: 50, paddingHorizontal: 4, textAlign: "right" },
  cPrice: { width: 80, paddingHorizontal: 4, textAlign: "right" },
  cSum: { width: 95, paddingHorizontal: 4, textAlign: "right" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 14,
  },
  totalBox: { width: 230 },
  totalLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  totalLabel: { color: faint },
  grandLabel: { fontSize: 11, fontWeight: 700 },
  grandValue: { fontSize: 13, fontWeight: 700, color: tenge },
  note: { color: faint, marginTop: 6, fontSize: 8 },
  signatures: { flexDirection: "row", gap: 40, marginTop: 48 },
  signBlock: { flex: 1 },
  signLine: {
    borderTopWidth: 1,
    borderColor: ink,
    marginTop: 24,
    paddingTop: 4,
    fontSize: 8,
    color: faint,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    fontSize: 7.5,
    color: faint,
    textAlign: "center",
  },
});

function Party({
  label,
  name,
  bin,
  director,
  address,
  bank,
}: {
  label: string;
  name: string;
  bin: string;
  director?: string | null;
  address?: string | null;
  bank?: string | null;
}) {
  return (
    <View style={s.party}>
      <Text style={s.partyLabel}>{label}</Text>
      <Text style={s.partyName}>{name}</Text>
      <Text style={s.meta}>БИН/ИИН: {bin}</Text>
      {address ? <Text style={s.meta}>{address}</Text> : null}
      {director ? <Text style={s.meta}>Рук.: {director}</Text> : null}
      {bank ? <Text style={s.meta}>{bank}</Text> : null}
    </View>
  );
}

export function InvoiceDocument({ doc }: { doc: PdfDoc }) {
  const isInvoice = doc.type === "invoice";
  const heading = isInvoice ? "Счёт на оплату" : "Акт выполненных работ";
  const company = doc.company;
  const cp = doc.counterparty;
  const bank =
    company.bank_name || company.bank_account
      ? `${company.bank_name ?? ""} ${company.bank_account ?? ""}`.trim()
      : null;

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.title}>
          {heading} № {doc.number}
        </Text>
        <Text style={s.sub}>от {formatDateRu(new Date(doc.date))}</Text>

        <View style={s.parties}>
          <Party
            label={isInvoice ? "Поставщик" : "Исполнитель"}
            name={company.name}
            bin={company.bin}
            director={company.director}
            address={company.address}
            bank={bank}
          />
          <Party
            label={isInvoice ? "Покупатель" : "Заказчик"}
            name={cp?.name ?? "—"}
            bin={cp?.bin ?? "—"}
            director={cp?.director}
            address={cp?.address}
          />
        </View>

        <View style={s.tableHead}>
          <Text style={s.cNum}>№</Text>
          <Text style={s.cDesc}>Наименование</Text>
          <Text style={s.cQty}>Кол-во</Text>
          <Text style={s.cPrice}>Цена</Text>
          <Text style={s.cSum}>Сумма</Text>
        </View>

        {doc.items.map((it, i) => (
          <View key={i} style={s.row} wrap={false}>
            <Text style={s.cNum}>{i + 1}</Text>
            <Text style={s.cDesc}>{it.description || "—"}</Text>
            <Text style={s.cQty}>{it.quantity}</Text>
            <Text style={s.cPrice}>{formatTenge(it.unitPrice)}</Text>
            <Text style={s.cSum}>{formatTenge(it.quantity * it.unitPrice)}</Text>
          </View>
        ))}

        <View style={s.totalRow}>
          <View style={s.totalBox}>
            <View style={s.totalLine}>
              <Text style={s.grandLabel}>
                {isInvoice ? "Итого к оплате" : "Стоимость работ"}
              </Text>
              <Text style={s.grandValue}>{formatTenge(doc.total_amount)}</Text>
            </View>
            <Text style={s.note}>Без НДС</Text>
          </View>
        </View>

        <View style={s.signatures}>
          <View style={s.signBlock}>
            <Text style={s.signLine}>
              {isInvoice ? "Поставщик" : "Исполнитель"}
              {company.director ? ` / ${company.director}` : ""} · М.П.
            </Text>
          </View>
          <View style={s.signBlock}>
            <Text style={s.signLine}>
              {isInvoice ? "Покупатель" : "Заказчик"} · М.П.
            </Text>
          </View>
        </View>

        <Text style={s.footer} fixed>
          Сформировано в «Быстрые деньги» · {doc.number}
        </Text>
      </Page>
    </Document>
  );
}
