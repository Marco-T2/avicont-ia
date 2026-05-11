import { z } from "zod";
import { EXPENSE_CATEGORIES } from "../domain/value-objects/expense-category";

export const createExpenseSchema = z.object({
  amount: z.number().positive("El monto debe ser mayor a 0"),
  category: z.enum(EXPENSE_CATEGORIES, { message: "Categoría de gasto inválida" }),
  description: z.string().optional(),
  date: z.coerce.date({ message: "Fecha inválida" }),
  lotId: z.string().cuid("ID de lote inválido"),
});

export const expenseIdSchema = z.string().cuid("ID de gasto inválido");
