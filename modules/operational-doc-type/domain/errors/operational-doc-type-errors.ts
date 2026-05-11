export class OperationalDocTypeNotFoundError extends Error {
  readonly statusCode = 404;
  constructor(id: string) {
    super(`Tipo de documento operacional no encontrado: ${id}`);
    this.name = "OperationalDocTypeNotFoundError";
  }
}

export class OperationalDocTypeDuplicateCodeError extends Error {
  readonly statusCode = 409;
  constructor(code: string) {
    super(`Tipo de documento operacional con código "${code}" ya existe`);
    this.name = "OperationalDocTypeDuplicateCodeError";
  }
}

export class OperationalDocTypeInUseError extends Error {
  readonly statusCode = 409;
  constructor(activePaymentsCount: number) {
    super(
      `Tipo de documento operacional tiene ${activePaymentsCount} pago(s) activo(s) asociado(s)`,
    );
    this.name = "OperationalDocTypeInUseError";
  }
}
