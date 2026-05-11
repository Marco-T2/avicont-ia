export class ProductTypeNotFoundError extends Error {
  readonly statusCode = 404;
  constructor(id: string) {
    super(`Tipo de producto no encontrado: ${id}`);
    this.name = "ProductTypeNotFoundError";
  }
}

export class ProductTypeDuplicateCodeError extends Error {
  readonly statusCode = 409;
  constructor(code: string) {
    super(`Tipo de producto con código "${code}" ya existe`);
    this.name = "ProductTypeDuplicateCodeError";
  }
}
