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
 * Thrown by the Lot repo adapter when a create/update collides with
 * the DB-level unique index on (organizationId, farmName, startDate).
 * Replaces the legacy `LotNameDuplicate` application-side guard —
 * post simplify-lot-identifier, uniqueness is enforced by Postgres
 * and surfaced as a Prisma P2002 we map to this typed error.
 *
 * Marco's verbatim rule: "se puede crear el nombre 'Granja Vinto -
 * 17/05/2026' jalando la fecha de inicio así nunca se tendrá 2 del
 * mismo" — the index is the enforcement, this error is the surface.
 */
export class LotForFarmAtDateExists extends Error {
  readonly code = "LOT_FOR_FARM_AT_DATE_EXISTS";
  constructor(farmName: string, startDate: Date) {
    const iso = startDate.toISOString().slice(0, 10);
    super(
      `Ya existe un lote para la granja "${farmName}" en la fecha ${iso}`,
    );
    this.name = "LotForFarmAtDateExists";
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
