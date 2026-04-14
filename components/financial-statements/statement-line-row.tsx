// Fila unificada de estado financiero con indentación proporcional al nivel
// Soporta: encabezado de subtipo, cuenta de detalle, subtotal y total de sección
export type StatementRowType = "header" | "account" | "subtotal" | "total";

interface StatementLineRowProps {
  type: StatementRowType;
  label: string;
  balance?: string;
  level?: number;
}

export function StatementLineRow({
  type,
  label,
  balance,
  level = 0,
}: StatementLineRowProps) {
  const paddingLeft = level * 16 + 16;

  if (type === "header") {
    return (
      <div
        className="flex items-center justify-between border-b border-gray-200 bg-gray-50 py-2 pr-4 font-semibold text-gray-800"
        style={{ paddingLeft: `${paddingLeft}px` }}
      >
        <span>{label}</span>
        {balance !== undefined && (
          <span className="font-mono text-sm">{balance}</span>
        )}
      </div>
    );
  }

  if (type === "account") {
    return (
      <div
        className="flex items-center justify-between border-b border-gray-100 py-1.5 pr-4 text-sm text-gray-700"
        style={{ paddingLeft: `${paddingLeft}px` }}
      >
        <span>{label}</span>
        {balance !== undefined && (
          <span className="font-mono">{balance}</span>
        )}
      </div>
    );
  }

  if (type === "subtotal") {
    return (
      <div
        className="flex items-center justify-between border-b border-gray-300 bg-gray-50/50 py-2 pr-4 text-sm font-medium text-gray-800"
        style={{ paddingLeft: `${paddingLeft}px` }}
      >
        <span className="italic">{label}</span>
        {balance !== undefined && (
          <span className="font-mono font-semibold">{balance}</span>
        )}
      </div>
    );
  }

  // type === "total"
  return (
    <div
      className="flex items-center justify-between border-b-2 border-gray-800 bg-gray-100 py-2.5 pr-4 font-bold text-gray-900"
      style={{ paddingLeft: `${paddingLeft}px` }}
    >
      <span>{label}</span>
      {balance !== undefined && (
        <span className="font-mono">{balance}</span>
      )}
    </div>
  );
}
