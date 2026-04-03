export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} no encontrado`, 404, "NOT_FOUND");
  }
}

export class ForbiddenError extends AppError {
  constructor() {
    super("No tenés acceso a este recurso", 403, "FORBIDDEN");
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, "VALIDATION");
  }
}

export class ConflictError extends AppError {
  constructor(resource: string) {
    super(`${resource} ya existe`, 409, "CONFLICT");
  }
}

export class UnauthorizedError extends AppError {
  constructor() {
    super("No autorizado", 401, "UNAUTHORIZED");
  }
}
