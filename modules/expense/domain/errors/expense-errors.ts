export class ExpenseNotFoundError extends Error {
  constructor(id: string) {
    super(`Gasto no encontrado: ${id}`);
    this.name = "ExpenseNotFoundError";
  }
}

export class ExpenseValidationError extends Error {
  constructor(message: string) {
    super(`Gasto inválido: ${message}`);
    this.name = "ExpenseValidationError";
  }
}
