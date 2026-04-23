import { z } from "zod";
import { ExpenseCategory } from "@/generated/prisma/client";

export const createExpenseSchema = z.object({
  amount: z.number().positive("El monto debe ser mayor a 0"),
  category: z.nativeEnum(ExpenseCategory, { message: "Categoría de gasto inválida" }),
  description: z.string().optional(),
  date: z.coerce.date({ message: "Fecha inválida" }),
  lotId: z.string().cuid("ID de lote inválido"),
});

export const expenseFiltersSchema = z.object({
  lotId: z.string().cuid("ID de lote inválido").optional(),
  category: z.nativeEnum(ExpenseCategory, { message: "Categoría de gasto inválida" }).optional(),
  dateFrom: z.coerce.date({ message: "Fecha desde inválida" }).optional(),
  dateTo: z.coerce.date({ message: "Fecha hasta inválida" }).optional(),
});

export const expenseIdSchema = z.string().cuid("ID de gasto inválido");

