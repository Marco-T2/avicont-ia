export class InvalidLotStatus extends Error {
  constructor(value: string) {
    super(`Estado de lote inválido: ${value}`);
    this.name = "InvalidLotStatus";
  }
}

export class InvalidLotStatusTransition extends Error {
  constructor(from: string, to: string) {
    super(`Transición de estado de lote inválida: ${from} → ${to}`);
    this.name = "InvalidLotStatusTransition";
  }
}

export class CannotCloseInactiveLot extends Error {
  constructor() {
    super("Solo se pueden cerrar lotes activos");
    this.name = "CannotCloseInactiveLot";
  }
}
