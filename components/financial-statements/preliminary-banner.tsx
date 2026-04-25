// Banner de estado preliminar — se muestra cuando el estado financiero
// se genera con datos no definitivos (período abierto o rango libre)
interface PreliminaryBannerProps {
  show: boolean;
}

export function PreliminaryBanner({ show }: PreliminaryBannerProps) {
  if (!show) return null;

  return (
    <div
      role="alert"
      className="flex items-center gap-3 rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-foreground"
    >
      <span className="text-lg font-bold">⚠</span>
      <div>
        <p className="font-semibold">Estado Preliminar</p>
        <p className="text-sm">
          Este estado financiero se basa en datos no definitivos. Los saldos
          pueden cambiar cuando el período sea cerrado oficialmente.
        </p>
      </div>
    </div>
  );
}
