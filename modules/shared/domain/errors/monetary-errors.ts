import { ValidationError } from "./index";

// Código de dominio compartido para violaciones de invariantes monetarios.
// Vive en shared/ porque MonetaryAmount es un VO cross-feature (rule of three:
// receivables, payables, payment). Antes existía duplicado en
// modules/{receivables,payables}/domain/errors/* — ambas declaraciones
// extendían ValidationError con el mismo string code, generando dos clases
// con identidad nominal distinta. Aquí queda una única clase canónica.
export const INVALID_MONETARY_AMOUNT = "INVALID_MONETARY_AMOUNT";

export class InvalidMonetaryAmount extends ValidationError {
  constructor(message: string) {
    super(message, INVALID_MONETARY_AMOUNT);
  }
}
