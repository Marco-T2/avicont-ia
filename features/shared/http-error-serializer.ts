import { ZodError } from "zod";
import { AppError } from "./errors";

export function handleError(error: unknown): Response {
  if (error instanceof ZodError) {
    return Response.json(
      { error: "Datos inválidos", details: error.flatten() },
      { status: 400 },
    );
  }
  if (error instanceof AppError) {
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.statusCode },
    );
  }
  console.error("Unhandled error:", error);
  return Response.json(
    { error: "Error interno del servidor" },
    { status: 500 },
  );
}
