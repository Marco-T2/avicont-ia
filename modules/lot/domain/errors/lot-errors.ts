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

/**
 * Thrown by `Lot.deactivate(endDate)` when invoked on a lot that is
 * already INACTIVE. Replaces the legacy `CannotCloseInactiveLot`
 * name; the semantics are identical (transition guard) — the rename
 * just aligns with the user-language verb "desactivar". Spec
 * REQ-203, design D-4.
 */
export class CannotDeactivateInactiveLot extends Error {
  constructor() {
    super("Solo se pueden desactivar lotes activos");
    this.name = "CannotDeactivateInactiveLot";
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
 * Thrown by Lot.update when the lot's status is not ACTIVE. INACTIVE
 * lots are historical snapshots; only ACTIVE lots can be edited
 * (spec REQ-100, scenario "Update rejected — Lot is INACTIVE").
 * Replaces the legacy `LotCannotUpdateClosed` name post-collapse
 * (REQ-202 binary lifecycle, design D-4).
 */
export class LotCannotUpdateInactive extends Error {
  readonly code = "LOT_INACTIVE";
  constructor(id: string) {
    super(`No se puede actualizar un lote inactivo: ${id}`);
    this.name = "LotCannotUpdateInactive";
  }
}
