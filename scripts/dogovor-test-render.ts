// Smoke test: render the Договор PDF.  bun run scripts/dogovor-test-render.ts
import { writeFile } from "node:fs/promises";
import React from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { DogovorDocument } from "../lib/pdf/dogovor";

const element = React.createElement(DogovorDocument, {
  doc: {
    number: "ДОГ-2026-001",
    title: "Договор оказания услуг",
    date: "2026-06-12",
    body:
      "1. Предмет договора.\nИсполнитель обязуется оказать услуги, а Заказчик — оплатить их.\n\n2. Стоимость и порядок расчётов.\nОбщая стоимость составляет 600 000 (шестьсот тысяч) тенге.\n\n3. Реквизиты сторон.",
    company: {
      name: "ИП «ЖДМ»",
      bin: "050916501298",
      director: "Жанбыршын Д. М.",
      address: "г. Шымкент, мкр. Нурсат, д. 1",
    },
    counterparty: {
      name: "ТОО «PHYTO-APIPHARM»",
      bin: "110240013813",
      director: "Жаскалиева Г. И.",
      address: "г. Шымкент, ул. Капал батыра, зд. 1/4",
    },
  },
}) as unknown as React.ReactElement<DocumentProps>;

const buf = Buffer.from(await renderToBuffer(element));
await writeFile("tmp-dogovor-test.pdf", buf);
console.log("bytes:", buf.length, "header:", buf.subarray(0, 5).toString());
