import { z } from "zod";
import { EXPENSE_CATEGORIES } from "../domain/value-objects/expense-category";

export const createExpenseSchema = z.object({
  amount: z.number().positive("El monto debe ser mayor a 0"),
  category: z.enum(EXPENSE_CATEGORIES, { message: "Categoría de gasto inválida" }),
  description: z.string().optional(),
  date: z.coerce.date({ message: "Fecha inválida" }),
  lotId: z.string().min(1, "ID de lote inválido"),
});

export const expenseIdSchema = z.string().min(1, "ID de gasto inválido");

/**
 * Editable fields on an Expense. All optional but at least ONE must
 * be present. `lotId` / `organizationId` / `createdById` are
 * immutable post-creation (INV-03). `description: null` clears
 * the field; `description: undefined` keeps the prior value.
 */
export const updateExpenseSchema = z
  .object({
    amount: z.number().positive("El monto debe ser mayor a 0").optional(),
    category: z
      .enum(EXPENSE_CATEGORIES, { message: "Categoría de gasto inválida" })
      .optional(),
    description: z.string().nullable().optional(),
    date: z.coerce.date({ message: "Fecha inválida" }).optional(),
  })
  .refine(
    (d) =>
      d.amount !== undefined ||
      d.category !== undefined ||
      d.description !== undefined ||
      d.date !== undefined,
    { message: "Debe enviar al menos un campo a actualizar" },
  );
