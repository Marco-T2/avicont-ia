import { InvalidDispatchType } from "../errors/dispatch-errors";

export const DISPATCH_TYPES = ["NOTA_DESPACHO", "BOLETA_CERRADA"] as const;

export type DispatchType = (typeof DISPATCH_TYPES)[number];

const VALID_SET = new Set<string>(DISPATCH_TYPES);

export function parseDispatchType(value: unknown): DispatchType {
  if (typeof value !== "string" || !VALID_SET.has(value)) {
    throw new InvalidDispatchType(String(value));
  }
  return value as DispatchType;
}
