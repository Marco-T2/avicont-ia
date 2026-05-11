export const EXPENSE_CATEGORIES = [
  "ALIMENTO",
  "CHALA",
  "AGUA",
  "GARRAFAS",
  "MANTENIMIENTO",
  "GALPONERO",
  "MEDICAMENTOS",
  "VETERINARIO",
  "OTROS",
] as const;

export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number];
