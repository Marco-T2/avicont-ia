// Exporter de PDF para comprobantes contables (JournalEntry).
// Función pura: recibe VoucherPdfInput ya compuesto → retorna Promise<Buffer>.
// Sin Prisma, sin Clerk, sin acceso al sistema de archivos.
//
// Layout (rediseño según referencia DEKMA):
//  - Header 2 col: logo (izq) | identidad org right-aligned (der) — SIN título
//  - Metadata 2 col inline "Label: valor":
//    · IZQ (8 filas): Fecha Comprobante, Tipo Comprobante, Referencia,
//      Tipo Cambio, Tipo Cambio UFV, A la Orden, Banco, Importe
//    · DER: Título grande `${type} ${number}` + 4 filas right-aligned
//      (Gestion, Localidad, ID Comprobante, Moneda)
//  - Glosa: full-width inline bold label "Glosa General: " + valor
//  - Tabla sin bordes verticales, solo una hline bajo header
//    · Cuenta = código
//    · Descripción = stack(accountName, description gris chico)
//  - Firmas: columnas con canvas line + label debajo (SIN cajas)
//  - Receptor: columnas con canvas line + label debajo (SIN cajas)

import type { Content, TDocumentDefinitions, TableCell } from "pdfmake/interfaces";
import {
  registerFonts,
  pdfmakeRuntime,
} from "@/features/accounting/financial-statements/exporters/pdf.fonts";
import type { VoucherPdfInput } from "./voucher-pdf.types";

const STYLE = {
  text: "#000000",
  textMuted: "#555555",
  textDescription: "#333333",
} as const;

const FONT = {
  titleLarge: 18,
  header: 11,
  body: 9,
  small: 8,
} as const;


// ── Header: logo izq | identidad der (sin título) ──

function buildHeader(input: VoucherPdfInput): Content {
  const { organization } = input;

  const logoStack: Content[] = [];
  if (organization.logoDataUrl) {
    logoStack.push({ image: organization.logoDataUrl, width: 55 });
  } else {
    logoStack.push({ text: " ", margin: [0, 0, 0, 0] });
  }

  const orgStack: Content[] = [
    { text: organization.branchName || organization.name, fontSize: FONT.header, bold: true, alignment: "right" },
  ];
  if (organization.address) {
    orgStack.push({ text: organization.address, fontSize: FONT.small, alignment: "right" });
  }
  if (organization.email) {
    orgStack.push({ text: organization.email, fontSize: FONT.small, alignment: "right", color: STYLE.textMuted });
  }

  return {
    columns: [
      { width: 80, stack: logoStack },
      { width: "*", stack: orgStack },
    ],
    margin: [0, 0, 0, 8],
  };
}

// ── Metadata: 2 columnas inline "Label: valor" ──

function inlineField(label: string, value: string, alignment: "left" | "right" = "left"): Content {
  return {
    text: [
      { text: `${label}: `, bold: true, color: STYLE.text },
      { text: value, color: STYLE.text },
    ],
    fontSize: FONT.body,
    alignment,
    margin: [0, 0.5, 0, 0.5],
  };
}

function buildMetadataBlock(input: VoucherPdfInput): Content {
  const v = input.voucher;

  const leftStack: Content[] = [
    inlineField("Fecha Comprobante", v.date),
    inlineField("Tipo Comprobante", v.type),
    inlineField("Referencia", v.reference || "—"),
    inlineField("Tipo Cambio", v.exchangeRate || "—"),
    inlineField("Tipo Cambio UFV", v.ufvRate || "—"),
    inlineField("A la Orden", v.payTo || "—"),
    inlineField("Banco", v.bank || "—"),
    inlineField("Importe", v.amountLiteral),
  ];

  const rightStack: Content[] = [
    {
      text: `${v.type} ${v.number}`,
      fontSize: FONT.titleLarge,
      bold: true,
      alignment: "right",
      margin: [0, 0, 0, 4],
    },
    inlineField("Gestion", v.gestion || "—", "right"),
    inlineField("Localidad", v.locality || "—", "right"),
    inlineField("ID Comprobante", v.internalId || "—", "right"),
    inlineField("Moneda", v.currency || "BS", "right"),
  ];

  return {
    columns: [
      { width: "60%", stack: leftStack },
      { width: "40%", stack: rightStack },
    ],
    margin: [0, 0, 0, 6],
  };
}

// ── Glosa: inline bold arriba de la tabla ──

function buildGlosa(input: VoucherPdfInput): Content {
  if (!input.voucher.glosa) return { text: "" };
  return {
    text: [
      { text: "Glosa General: ", bold: true, color: STYLE.text },
      { text: input.voucher.glosa, color: STYLE.text },
    ],
    fontSize: FONT.body,
    margin: [0, 4, 0, 8],
  };
}

// ── Tabla de asientos ──

function hasUsd(input: VoucherPdfInput): boolean {
  return (input.totals.debitUsd ?? "") !== "" || (input.totals.creditUsd ?? "") !== "";
}

function buildEntriesTable(input: VoucherPdfInput): Content {
  const includeUsd = hasUsd(input);

  const header: TableCell[] = [
    { text: "Cuenta", bold: true, fontSize: FONT.body, margin: [0, 3, 3, 3] },
    { text: "Descripcion", bold: true, fontSize: FONT.body, margin: [3, 3, 3, 3] },
    { text: "Debe Bs", bold: true, fontSize: FONT.body, alignment: "right", margin: [3, 3, 3, 3] },
    { text: "Haber Bs", bold: true, fontSize: FONT.body, alignment: "right", margin: [3, 3, 3, 3] },
  ];
  if (includeUsd) {
    header.push(
      { text: "Debe USD", bold: true, fontSize: FONT.body, alignment: "right", margin: [3, 3, 3, 3] },
      { text: "Haber USD", bold: true, fontSize: FONT.body, alignment: "right", margin: [3, 3, 3, 3] },
    );
  }

  const body: TableCell[][] = [header];

  for (const e of input.entries) {
    const descStack: TableCell = {
      stack: [
        { text: e.accountName, fontSize: FONT.body },
        { text: e.description, fontSize: 7, color: STYLE.textDescription, margin: [0, 1, 0, 0], lineHeight: 1.15 },
      ],
      margin: [3, 2, 3, 4],
    };
    const row: TableCell[] = [
      { text: e.accountCode, fontSize: FONT.body, margin: [0, 2, 3, 2] },
      descStack,
      { text: e.debitBs, fontSize: FONT.body, alignment: "right", margin: [3, 2, 3, 2] },
      { text: e.creditBs, fontSize: FONT.body, alignment: "right", margin: [3, 2, 3, 2] },
    ];
    if (includeUsd) {
      row.push(
        { text: e.debitUsd, fontSize: FONT.body, alignment: "right", margin: [3, 2, 3, 2] },
        { text: e.creditUsd, fontSize: FONT.body, alignment: "right", margin: [3, 2, 3, 2] },
      );
    }
    body.push(row);
  }

  const totalsRow: TableCell[] = [
    {},
    { text: "TOTAL", bold: true, fontSize: FONT.body, alignment: "center", margin: [3, 4, 3, 3] },
    { text: input.totals.debitBs, bold: true, fontSize: FONT.body, alignment: "right", margin: [3, 4, 3, 3] },
    { text: input.totals.creditBs, bold: true, fontSize: FONT.body, alignment: "right", margin: [3, 4, 3, 3] },
  ];
  if (includeUsd) {
    totalsRow.push(
      { text: input.totals.debitUsd, bold: true, fontSize: FONT.body, alignment: "right", margin: [3, 4, 3, 3] },
      { text: input.totals.creditUsd, bold: true, fontSize: FONT.body, alignment: "right", margin: [3, 4, 3, 3] },
    );
  }
  body.push(totalsRow);

  // TODAS las columnas en pt fijos (no usamos "*") para que pdfmake NO expanda
  // la descripción cuando es larga — fuerza wrap estricto dentro del ancho.
  // Page Letter = 612pt, margins 40+40 → 532pt disponibles.
  const widths: (string | number)[] = includeUsd
    ? [55, 250, 55, 55, 55, 55]   // sum = 525
    : [75, 310, 70, 70];           // sum = 525

  return {
    table: { widths, body, headerRows: 1 },
    layout: {
      // Solo una hline sutil debajo del header.
      hLineWidth: (i) => (i === 1 ? 0.5 : 0),
      vLineWidth: () => 0,
      hLineColor: () => "#888888",
    },
    margin: [0, 0, 0, 8],
  };
}

// ── Firmas: UNA mini-tabla por firma dentro de un layout de columns ──
// Cada firma es una tabla independiente → las hLines NO se tocan entre cols.
// `columnGap` crea el aire visual entre firmas. Escala de 1 a N firmas.

const SIG_COLUMN_GAP = 16;

function sigMiniTable(label: string, name: string | undefined): Content {
  const labelStack: Content[] = [
    { text: label, bold: true, fontSize: FONT.small, alignment: "center" },
  ];
  if (name) {
    labelStack.push({
      text: name,
      fontSize: FONT.small,
      color: STYLE.textMuted,
      alignment: "center",
    });
  }

  // width is a valid ColumnProperties key when this item is used inside a
  // pdfmake `columns` array (Column = Content & ColumnProperties). The TS
  // types don't expose ColumnProperties on ContentTable directly, so we
  // bridge through unknown to preserve the runtime-correct value.
  return {
    width: "*",
    table: {
      widths: ["*"],
      body: [
        [{ text: " ", margin: [0, 0, 0, 28] }],
        [{ stack: labelStack, margin: [0, 4, 0, 0] }],
      ],
    },
    layout: {
      hLineWidth: (i: number) => (i === 1 ? 0.7 : 0),
      vLineWidth: () => 0,
      hLineColor: () => STYLE.text,
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 0,
    },
  } as unknown as Content;
}

function buildSignatures(input: VoucherPdfInput): Content {
  const keys = Object.keys(input.signatures);
  if (keys.length === 0) return { text: "" };

  const cols = keys.map((key) =>
    sigMiniTable(input.signatures[key].label, input.signatures[key].name),
  );

  return {
    columns: cols,
    columnGap: SIG_COLUMN_GAP,
    margin: [0, 20, 0, 0],
  };
}

// ── Receptor: misma técnica (mini-tabla por celda, columnGap entre) ──

function receiverMiniTable(label: string, value: string | undefined): Content {
  return {
    width: "*",
    table: {
      widths: ["*"],
      body: [
        [
          {
            text: value || " ",
            fontSize: FONT.body,
            alignment: "center",
            margin: [0, 0, 0, 28],
          },
        ],
        [
          {
            text: label,
            fontSize: FONT.small,
            bold: true,
            alignment: "center",
            margin: [0, 4, 0, 0],
          },
        ],
      ],
    },
    layout: {
      hLineWidth: (i: number) => (i === 1 ? 0.7 : 0),
      vLineWidth: () => 0,
      hLineColor: () => STYLE.text,
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 0,
    },
  } as unknown as Content;
}

function buildReceiverRow(input: VoucherPdfInput): Content {
  if (!input.footer) return { text: "" };
  const { nombreApellido, ci, firma } = input.footer;
  return {
    columns: [
      receiverMiniTable(nombreApellido.label, nombreApellido.value),
      receiverMiniTable(ci.label, ci.value),
      receiverMiniTable(firma.label, firma.value),
    ],
    columnGap: SIG_COLUMN_GAP,
    margin: [0, 24, 0, 0],
  };
}

// ── Doc definition ──

function buildDocDefinition(input: VoucherPdfInput): TDocumentDefinitions {
  const content: Content[] = [
    buildHeader(input),
    buildMetadataBlock(input),
    buildGlosa(input),
    buildEntriesTable(input),
    buildSignatures(input),
    buildReceiverRow(input),
  ];

  return {
    pageSize: "LETTER",
    pageOrientation: "portrait",
    pageMargins: [40, 40, 40, 40],
    footer: (currentPage: number, pageCount: number): Content => ({
      text: `${currentPage} / ${pageCount}`,
      alignment: "right",
      fontSize: FONT.small,
      color: STYLE.textMuted,
      margin: [40, 0, 40, 0],
    }),
    defaultStyle: {
      font: "Roboto",
      fontSize: FONT.body,
      color: STYLE.text,
    },
    content,
  };
}

/**
 * Genera el PDF de un comprobante contable como Buffer.
 */
export async function exportVoucherPdf(input: VoucherPdfInput): Promise<Buffer> {
  registerFonts();
  const docDef = buildDocDefinition(input);
  return pdfmakeRuntime.createPdf(docDef).getBuffer();
}
