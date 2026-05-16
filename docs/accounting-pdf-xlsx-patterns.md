# Mapa de patrones — PDF + Excel de reportes contables

> Guía de referencia para implementar exporters PDF/XLSX nuevos (Libro Mayor, otros).
> Cada sección apunta a código concreto del repo para copiar/adaptar.

---

## 1. Helpers compartidos (shared/infrastructure/exporters/)

| Helper | Archivo | Para qué |
|--------|---------|---------|
| `buildExecutivePdfHeader(opts)` | `modules/accounting/shared/infrastructure/exporters/executive-pdf-header.ts` | Header membrete: Empresa/NIT/Dirección/Ciudad (izq 8pt) + TÍTULO centrado + período + "(Expresado en Bolivianos)" |
| `spaceLetters("TOTAL ACTIVO")` | `modules/accounting/shared/infrastructure/exporters/pdf-staircase.ts` | Letter-spacing emulado: `"T O T A L   A C T I V O"` para grand-totals |
| `wrapWithTopBorder(content)` | `modules/accounting/shared/infrastructure/exporters/pdf-staircase.ts` | Nested table 1×1 para dibujar línea SOLO bajo la columna (workaround pdfmake) |
| `fmtDecimal(d, isTotal)` | `modules/accounting/shared/infrastructure/exporters/pdf.helpers.ts` | Format es-BO con paréntesis negativos. `isTotal=true` muestra 0,00; `false` muestra "" |
| `registerFonts()` + `pdfmakeRuntime` | `modules/accounting/shared/infrastructure/exporters/pdf.fonts.ts` | Setup Roboto bundled (llamar SIEMPRE antes de createPdf) |

---

## 2. Estructura tipo de un PDF exporter

Ver: `modules/accounting/trial-balance/infrastructure/exporters/trial-balance-pdf.exporter.ts`

```ts
import { registerFonts, pdfmakeRuntime } from "@/modules/accounting/shared/infrastructure/exporters/pdf.fonts";
import { fmtDecimal } from "@/modules/accounting/shared/infrastructure/exporters/pdf.helpers";
import { buildExecutivePdfHeader } from "@/modules/accounting/shared/infrastructure/exporters/executive-pdf-header";

// ── Tamaños canónicos ──
const BODY_SIZE = 8;        // landscape 14 cols → no subir; portrait → 10
const TITLE_SIZE = 18;      // portrait — landscape usa 16
const SUBTITLE_SIZE = 10;
const ORG_INFO_SIZE = 8;

function buildDocDefinition(report, orgName, orgNit?, orgAddress?, orgCity?) {
  const headerContent = buildExecutivePdfHeader({
    orgName, orgNit, orgAddress, orgCity,
    title: "Balance de Comprobación de Sumas y Saldos",
    subtitle: `Del ${fmtDate(dateFrom)} al ${fmtDate(dateTo)}`,
    titleFontSize: TITLE_SIZE,
    subtitleFontSize: SUBTITLE_SIZE,
    orgInfoFontSize: ORG_INFO_SIZE,
    orgInfoAlignment: "left",  // estilo membrete
  });
  // ... tabla + imbalance banner + content
  return { pageSize: "A4", pageOrientation: "portrait", content, ... };
}

export async function exportXxxPdf(report, orgName, orgNit?, orgAddress?, orgCity?) {
  if (!orgName) throw new MissingOrgNameError();
  registerFonts();
  const docDef = buildDocDefinition(report, orgName, orgNit, orgAddress, orgCity);
  const buffer = await pdfmakeRuntime.createPdf(docDef).getBuffer();
  return { buffer: Buffer.from(buffer), docDef };
}
```

**Reglas**:
- **NUNCA** watermark "PRELIMINAR" — está fuera por decisión UX (eliminado en los 5 reportes).
- **Anchos de columna** en tablas anchas: usar `"*"` para distribuir canto a canto. Ver `worksheet-pdf.exporter.ts.buildWidths()`.
- **A4 landscape** → 14 columnas máximo, BODY 7-8pt. **A4 portrait** → 8-12 columnas, BODY 10pt.

---

## 3. `getOrgMetadata` real (no hardcoded)

Patrón en `modules/accounting/financial-statements/infrastructure/prisma-financial-statements.repo.ts` (líneas ~240-285):

```ts
async getOrgMetadata(orgId: string): Promise<XxxOrgMetadata | null> {
  const org = await this.db.organization.findUnique({
    where: { id: orgId },
    select: {
      name: true,
      profile: {
        select: { razonSocial: true, nit: true, direccion: true, ciudad: true },
      },
    },
  });
  if (!org) return null;

  const profile = org.profile;
  const name =
    profile?.razonSocial && profile.razonSocial.trim().length > 0
      ? profile.razonSocial
      : org.name;

  const trimOrNull = (v) => {
    const t = v?.trim();
    return t && t.length > 0 ? t : null;
  };

  return {
    name,
    taxId: trimOrNull(profile?.nit),       // o `nit` según el shape del módulo
    address: trimOrNull(profile?.direccion),
    city: trimOrNull(profile?.ciudad),
  };
}
```

Tipo asociado (ej. `WorksheetOrgMetadata`):
```ts
export type XxxOrgMetadata = {
  name: string;
  taxId: string | null;       // o `nit`
  address: string | null;
  city: string | null;
};
```

---

## 4. Staircase BCB en single-col

Ver: `modules/accounting/financial-statements/infrastructure/exporters/pdf.exporter.ts`

**Solo si el reporte tiene jerarquía** (section → subgroup → account). NO aplica al Libro Mayor (tabla plana).

Pasos:
1. `absorbStaircase(rows)` — función pura que reordena: `subtotal` → absorbe en `header-subtype` anterior, `total` → copia saldo a `header-section` (mantiene la fila como cierre).
2. 4 columnas físicas single-col: `[*, detalle(80), subtotal(80), total(110)]`.
3. Cuentas: `{código}  {NOMBRE EN MAYÚS}` en col detalle.
4. Headers de subtype en col subtotal con saldo absorbido bold.
5. Headers de sección en col total (MAYÚS plano, bold +1).
6. Filas TOTAL con `spaceLetters` + `wrapWithTopBorder` (línea bajo el número).

---

## 5. Route handler (PDF inline + Excel attachment)

Patrón: `app/api/organizations/[orgSlug]/{report}/route.ts`

```ts
if (query.format === "pdf") {
  const orgMeta = await repo.getOrgMetadata(orgId);
  const { buffer } = await exportXxxPdf(
    report,
    orgMeta?.name ?? orgSlug,
    orgMeta?.taxId ?? undefined,
    orgMeta?.address ?? undefined,
    orgMeta?.city ?? undefined,
  );
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      // inline → browser renderiza en pestaña nueva (visor nativo)
      "Content-Disposition": `inline; filename="xxx-${orgSlug}-${periodLabel}.pdf"`,
    },
  });
}

if (query.format === "xlsx") {
  const buffer = await exportXxxXlsx(report, ...);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      // attachment → el browser NO renderiza .xlsx, fuerza descarga
      "Content-Disposition": `attachment; filename="xxx-${orgSlug}-${periodLabel}.xlsx"`,
    },
  });
}
```

**Regla**: PDF siempre `inline`, Excel siempre `attachment`.

---

## 6. UI page-client (botones export + sub-header)

Patrón: `components/accounting/trial-balance-page-client.tsx` o `worksheet-page-client.tsx`

```tsx
import { Button } from "@/components/ui/button";
import { Loader2, Printer, FileSpreadsheet } from "lucide-react";
import { formatDateBO } from "@/lib/date-utils";

// State para spinner SOLO de Excel — PDF no necesita (window.open es instantáneo).
const [loadingXlsx, setLoadingXlsx] = useState(false);

function buildExportUrl(format: "pdf" | "xlsx"): string | null {
  if (!lastFilters) return null;
  const params = new URLSearchParams({ ...filtros, format });
  return `/api/organizations/${orgSlug}/{report}?${params.toString()}`;
}

function handleOpenPdf() {
  const url = buildExportUrl("pdf");
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
}

async function handleDownloadXlsx() {
  // blob + download manual (browser NO renderiza .xlsx inline)
  setLoadingXlsx(true);
  try {
    const res = await fetch(buildExportUrl("xlsx")!);
    if (!res.ok) return;
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `{filename}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } finally {
    setLoadingXlsx(false);
  }
}

// JSX
<div className="flex gap-2">
  <Button type="button" variant="outline" size="sm" onClick={handleOpenPdf}
    aria-label="Abrir PDF en pestaña nueva">
    <Printer className="h-4 w-4 mr-1.5" />
    PDF
  </Button>
  <Button type="button" variant="outline" size="sm" onClick={handleDownloadXlsx}
    disabled={loadingXlsx} aria-label="Descargar como Excel">
    {loadingXlsx ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                 : <FileSpreadsheet className="h-4 w-4 mr-1.5" />}
    Excel
  </Button>
</div>

{/* Sub-header dentro del Card */}
<Card>
  <CardContent className="pt-0 pb-6 px-0 overflow-auto">  {/* ojo: pt-0 NO pt-4 */}
    <div className="px-6 pb-4 text-center">
      <h2 className="text-xl font-bold tracking-wide">NOMBRE DEL REPORTE</h2>
      <p className="text-sm text-muted-foreground mt-1">
        Del {formatDateBO(new Date(dateFrom))} al {formatDateBO(new Date(dateTo))}
      </p>
      <p className="text-xs italic text-muted-foreground">
        (Expresado en Bolivianos)
      </p>
    </div>
    {/* tabla aquí */}
  </CardContent>
</Card>
```

**Reglas UI**:
- Botón PDF: `<Printer/> PDF`, **NO** loading state, `window.open`.
- Botón Excel: `<FileSpreadsheet/> Excel`, loading state, blob+download.
- Sub-header del Card: título MAYÚS `text-xl font-bold tracking-wide`, fecha `text-sm muted mt-1`, currency `text-xs italic muted`.
- CardContent: **`pt-0`** (no `pt-4`) — el Card aporta `py-6` propio + sub-header tiene `pb-4`.

---

## 7. Decimal: SIEMPRE decimal.js, NUNCA Prisma.Decimal en domain

Regla **DEC-1** (locked). Si necesitás money math en domain/application:

```ts
import Decimal from "decimal.js";

const x = new Decimal("123.45");
const y = x.plus("67.89").minus(10);
```

En **infrastructure (repos)** podés usar `Prisma.Decimal` para reads:
```ts
const balance = new Prisma.Decimal(row.balance);
```

PERO **al cruzar el port** (devolver al service) convertí a decimal.js:
```ts
return rows.map(r => ({
  ...r,
  amount: new Decimal(r.amount.toString()),  // ← convierte aquí
}));
```

**Bug que ya pasó** (commit `de386ab7`): el alias `type Decimal = Prisma.Decimal` en initial-balance hizo que el serializer del frontera (`serializeStatement`) no detectara los Decimals (chequea `instanceof decimal.js Decimal`) y los enviara como `{}` al cliente → `parseFloat({}) = NaN` → `formatBOB` devolvía "Bs. 0,00".

---

## 8. Para Libro Mayor (próximo sprint)

**Notas específicas** dado que la tabla es plana de N columnas:

- **NO aplica staircase** (no hay jerarquía).
- Columnas: Fecha | Tipo | Nº | Descripción | Debe | Haber | Saldo.
- **`openingBalance`** del DTO: si !== "0.00", primera fila bold "Saldo inicial acumulado" en col Saldo.
- **Filtros del header** debajo del título: Cuenta + Período (Del X al Y).
- **Acciones por fila** NO en el PDF (no son interactivas). El PDF es snapshot estático.
- Reusar `formatCorrelativeNumber(prefix, date, number)` desde `@/modules/accounting/domain/correlative.utils` para mostrar `displayNumber` tipo `D2605-000001`.
- Cuidado con **paginación**: el PDF debería traer TODAS las páginas, no solo la actual. Usar `getAccountLedger` (no paginado) en el route handler para format=pdf/xlsx.

**Archivos a tocar** (estimación):
- `modules/accounting/infrastructure/exporters/ledger-pdf.exporter.ts` (nuevo)
- `modules/accounting/infrastructure/exporters/ledger-xlsx.exporter.ts` (nuevo)
- `modules/accounting/presentation/server.ts` o barrel — exportar las nuevas funciones
- `app/api/organizations/[orgSlug]/accounting/ledger/route.ts` (existe?) o route handler nuevo
- `components/accounting/ledger-page-client.tsx` — agregar botones export con patrón del §6

---

## 9. Mini-checklist al implementar un export nuevo

- [ ] **Repo `getOrgMetadata`**: JOIN con OrgProfile (clone trial-balance/worksheet/etc.)
- [ ] **Tipo `XxxOrgMetadata`**: `{name, taxId, address, city}`
- [ ] **PDF exporter**: usar `buildExecutivePdfHeader` + `fmtDecimal` + `registerFonts`
- [ ] **Tamaños canónicos**: portrait 10/18/10, landscape 7-8/16/10
- [ ] **Anchos de tabla**: `"*"` para distribuir canto a canto cuando sea apropiado
- [ ] **NO watermark PRELIMINAR**
- [ ] **Imbalance banner** si el reporte tiene esa propiedad
- [ ] **Route handler**: PDF `inline`, Excel `attachment`. Pasa metadata real al exporter.
- [ ] **Page-client UI**: `<Printer/> PDF` + `<FileSpreadsheet/> Excel`, `window.open` para PDF
- [ ] **Sub-header del Card**: `pt-0`, título MAYÚS, fecha, "(Expresado en Bolivianos)"
- [ ] **Tests**: shape del exporter (docDef contiene Empresa/NIT/título), serialización Decimal
- [ ] **tsc + vitest** del módulo verde antes de commitear
