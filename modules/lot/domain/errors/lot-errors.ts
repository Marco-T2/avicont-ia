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

/**
 * Thrown by LotService.update when the requested new name collides
 * with another existing Lot's name in the same organization (spec
 * REQ-100, scenario "Update rejected — name already taken in org").
 */
export class LotNameDuplicate extends Error {
  readonly code = "LOT_NAME_DUPLICATE";
  constructor(name: string) {
    super(`Ya existe un lote con el nombre "${name}" en la organización`);
    this.name = "LotNameDuplicate";
  }
}

/**
 * Thrown by Lot.update when the lot's status is not ACTIVE. Closed
 * lots are historical snapshots; only ACTIVE lots can be edited
 * (spec REQ-100, scenario "Update rejected — Lot is CLOSED").
 */
export class LotCannotUpdateClosed extends Error {
  readonly code = "LOT_CLOSED";
  constructor(id: string) {
    super(`No se puede actualizar un lote cerrado: ${id}`);
    this.name = "LotCannotUpdateClosed";
  }
}
