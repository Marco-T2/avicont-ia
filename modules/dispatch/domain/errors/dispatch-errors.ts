import { ValidationError } from "@/features/shared/errors";

export {
  DISPATCH_NO_DETAILS,
  DISPATCH_BC_FIELDS_ON_ND,
  DISPATCH_INVALID_CONTACT_TYPE,
  DISPATCH_NOT_DRAFT,
  DISPATCH_CONTACT_CHANGE_BLOCKED,
  INVALID_STATUS_TRANSITION,
  ENTRY_VOIDED_IMMUTABLE,
} from "@/features/shared/errors";

export const INVALID_DISPATCH_STATUS = "INVALID_DISPATCH_STATUS";
export const INVALID_DISPATCH_TYPE = "INVALID_DISPATCH_TYPE";
export const INVALID_DISPATCH_DETAIL_LINE = "INVALID_DISPATCH_DETAIL_LINE";

import {
  DISPATCH_NO_DETAILS,
  DISPATCH_NOT_DRAFT,
  DISPATCH_BC_FIELDS_ON_ND,
  INVALID_STATUS_TRANSITION,
  ENTRY_VOIDED_IMMUTABLE,
} from "@/features/shared/errors";

export class InvalidDispatchStatus extends ValidationError {
  constructor(value: string) {
    super(`Estado de despacho inválido: ${value}`, INVALID_DISPATCH_STATUS, {
      value,
    });
    this.name = "InvalidDispatchStatus";
  }
}

export class InvalidDispatchType extends ValidationError {
  constructor(value: string) {
    super(`Tipo de despacho inválido: ${value}`, INVALID_DISPATCH_TYPE, {
      value,
    });
    this.name = "InvalidDispatchType";
  }
}

export class InvalidDispatchDetailLine extends ValidationError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, INVALID_DISPATCH_DETAIL_LINE, context);
    this.name = "InvalidDispatchDetailLine";
  }
}

export class DispatchNoDetails extends ValidationError {
  constructor() {
    super(
      "El despacho debe tener al menos una línea de detalle para ser contabilizado",
      DISPATCH_NO_DETAILS,
    );
    this.name = "DispatchNoDetails";
  }
}

export class DispatchNotDraft extends ValidationError {
  constructor() {
    super(
      "Solo se pueden eliminar despachos en estado BORRADOR",
      DISPATCH_NOT_DRAFT,
    );
    this.name = "DispatchNotDraft";
  }
}

export class InvalidDispatchStatusTransition extends ValidationError {
  constructor(current: string, target: string) {
    super(
      `Transición inválida: ${current} → ${target}`,
      INVALID_STATUS_TRANSITION,
      { current, target },
    );
    this.name = "InvalidDispatchStatusTransition";
  }
}

export class DispatchVoidedImmutable extends ValidationError {
  constructor() {
    super(
      "Un despacho anulado no puede ser modificado",
      ENTRY_VOIDED_IMMUTABLE,
    );
    this.name = "DispatchVoidedImmutable";
  }
}

export class DispatchBcFieldsOnNd extends ValidationError {
  constructor() {
    super(
      "Los campos de Boleta Cerrada no son permitidos en Notas de Despacho",
      DISPATCH_BC_FIELDS_ON_ND,
    );
    this.name = "DispatchBcFieldsOnNd";
  }
}
