// Banner de ecuación contable desbalanceada — muestra el delta en BOB
// Solo aplica al Balance General (Estado de Situación Patrimonial)
interface ImbalanceBannerProps {
  imbalanced: boolean;
  imbalanceDelta?: string;
}

export function ImbalanceBanner({
  imbalanced,
  imbalanceDelta,
}: ImbalanceBannerProps) {
  if (!imbalanced) return null;

  return (
    <div
      role="alert"
      className="flex items-center gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-destructive"
    >
      <span className="text-lg font-bold">✕</span>
      <div>
        <p className="font-semibold">Ecuación Contable Desbalanceada</p>
        <p className="text-sm">
          Activo ≠ Pasivo + Patrimonio.{" "}
          {imbalanceDelta !== undefined && (
            <span>
              Delta:{" "}
              <span className="font-mono font-semibold">
                Bs. {imbalanceDelta}
              </span>
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
