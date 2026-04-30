import {
  PURCHASE_CONTACT_INACTIVE,
  PURCHASE_INVALID_CONTACT_TYPE,
  ValidationError,
} from "@/features/shared/errors";

export {
  PURCHASE_CONTACT_INACTIVE,
  PURCHASE_INVALID_CONTACT_TYPE,
} from "@/features/shared/errors";

export class PurchaseContactNotProvider extends ValidationError {
  constructor(contactType: string) {
    super(
      "El contacto debe ser de tipo PROVEEDOR para crear una compra",
      PURCHASE_INVALID_CONTACT_TYPE,
      { contactType },
    );
    this.name = "PurchaseContactNotProvider";
  }
}

export class PurchaseContactInactive extends ValidationError {
  constructor(contactId: string) {
    super(
      "El contacto está inactivo y no puede usarse en una compra",
      PURCHASE_CONTACT_INACTIVE,
      { contactId },
    );
    this.name = "PurchaseContactInactive";
  }
}
