import path from "node:path";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import { formatDateRu } from "@/lib/format";

// Cyrillic font (same TTFs the invoice PDF uses). Re-registering the same family
// is idempotent; keeping it here makes this module self-contained.
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
Font.registerHyphenationCallback((word) => [word]);

export type DogovorParty = {
  name: string;
  bin: string;
  director?: string | null;
  address?: string | null;
};

export type DogovorPdf = {
  number: string;
  title?: string | null;
  date: string;
  body: string;
  company: DogovorParty;
  counterparty: DogovorParty;
};

const ink = "#211d17";
const faint = "#8a8173";
const line = "#d9d2c5";

const s = StyleSheet.create({
  page: {
    fontFamily: "PT Sans",
    fontSize: 10,
    color: ink,
    paddingVertical: 48,
    paddingHorizontal: 52,
    lineHeight: 1.5,
  },
  title: { fontSize: 15, fontWeight: 700, textAlign: "center" },
  number: { fontSize: 9, color: faint, textAlign: "center", marginTop: 3 },
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
  meta: { color: faint, marginTop: 1, fontSize: 9 },
  body: { marginTop: 24 },
  para: { marginBottom: 8, textAlign: "justify" },
  signatures: { flexDirection: "row", gap: 40, marginTop: 44 },
  signBlock: { flex: 1 },
  signRole: { fontSize: 8, color: faint, marginBottom: 2 },
  signName: { fontWeight: 700 },
  signLine: {
    borderTopWidth: 1,
    borderColor: ink,
    marginTop: 26,
    paddingTop: 4,
    fontSize: 8,
    color: faint,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 52,
    right: 52,
    fontSize: 7.5,
    color: faint,
    textAlign: "center",
  },
});

function Party({ label, party }: { label: string; party: DogovorParty }) {
  return (
    <View style={s.party}>
      <Text style={s.partyLabel}>{label}</Text>
      <Text style={s.partyName}>{party.name}</Text>
      <Text style={s.meta}>БИН/ИИН: {party.bin}</Text>
      {party.address ? <Text style={s.meta}>{party.address}</Text> : null}
      {party.director ? <Text style={s.meta}>Рук.: {party.director}</Text> : null}
    </View>
  );
}

export function DogovorDocument({ doc }: { doc: DogovorPdf }) {
  // Preserve the author's line breaks: blank lines separate paragraphs.
  const paragraphs = doc.body.replace(/\r\n/g, "\n").split("\n");

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.title}>{doc.title?.trim() || "Договор"}</Text>
        <Text style={s.number}>
          № {doc.number} · {formatDateRu(new Date(doc.date))}
        </Text>

        <View style={s.parties}>
          <Party label="Исполнитель" party={doc.company} />
          <Party label="Заказчик" party={doc.counterparty} />
        </View>

        <View style={s.body}>
          {paragraphs.map((p, i) => (
            <Text key={i} style={s.para}>
              {p || " "}
            </Text>
          ))}
        </View>

        <View style={s.signatures}>
          <View style={s.signBlock}>
            <Text style={s.signRole}>Исполнитель</Text>
            <Text style={s.signName}>{doc.company.name}</Text>
            <Text style={s.signLine}>подпись / ЭЦП</Text>
          </View>
          <View style={s.signBlock}>
            <Text style={s.signRole}>Заказчик</Text>
            <Text style={s.signName}>{doc.counterparty.name}</Text>
            <Text style={s.signLine}>подпись / ЭЦП</Text>
          </View>
        </View>

        <Text style={s.footer} fixed>
          Документ подписывается электронной цифровой подписью (ЭЦП).
        </Text>
      </Page>
    </Document>
  );
}
