import { InvalidIvaSalesEstadoSIN } from "../errors/iva-book-errors";

export const IVA_SALES_ESTADOS_SIN = ["A", "V", "C", "L"] as const;

export type IvaSalesEstadoSIN = (typeof IVA_SALES_ESTADOS_SIN)[number];

const VALID_SET = new Set<string>(IVA_SALES_ESTADOS_SIN);

export function parseIvaSalesEstadoSIN(value: unknown): IvaSalesEstadoSIN {
  if (typeof value !== "string" || !VALID_SET.has(value)) {
    throw new InvalidIvaSalesEstadoSIN(String(value));
  }
  return value as IvaSalesEstadoSIN;
}
