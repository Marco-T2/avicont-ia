// Advertencia de cuentas no-contra cuyo balance final aterrizó con signo
// opuesto a su naturaleza contable. Señal de calidad para el contador —
// la ecuación Activo = Pasivo + Patrimonio sigue cuadrando porque el
// builder netea, pero el negativo en columna Activo (o Pasivo) suele
// indicar un anticipo no reclasificado o un error de carga.
//
// Contra-cuentas (depreciación, provisiones) y la línea sintética de
// Resultado/Pérdida del Ejercicio NO aparecen acá — sus signos son
// by-design, no anomalías.

interface OppositeSignAccount {
  code: string;
  name: string;
  section: "ACTIVO" | "PASIVO" | "PATRIMONIO";
  balance: string;
}

interface OppositeSignWarningProps {
  accounts: OppositeSignAccount[];
}

function fmtBOB(value: string): string {
  const n = parseFloat(value);
  if (isNaN(n)) return value;
  return n.toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function OppositeSignWarning({ accounts }: OppositeSignWarningProps) {
  if (accounts.length === 0) return null;

  return (
    <div
      role="alert"
      className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs"
    >
      <p className="font-semibold text-destructive">
        Cuentas con saldo de naturaleza opuesta — revisar carga antes del cierre:
      </p>
      <ul className="mt-1 list-disc pl-5 space-y-0.5">
        {accounts.map((a) => (
          <li key={`${a.section}-${a.code}`}>
            <span className="font-mono">{a.code}</span> {a.name}{" "}
            <span className="text-muted-foreground">({a.section})</span> — Bs{" "}
            {fmtBOB(a.balance)}
          </li>
        ))}
      </ul>
    </div>
  );
}
