import { AccountType, AccountSubtype } from "@/generated/prisma/client";

/**
 * Matriz de subtipos permitidos por tipo de cuenta (regla NIIF/PCGA).
 * Es un Record exhaustivo: todos los valores de AccountType deben estar presentes.
 * Si se agrega un valor al enum AccountType, TypeScript emitirá un error aquí.
 */
export const SUBTYPES_BY_TYPE: Record<AccountType, AccountSubtype[]> = {
  [AccountType.ACTIVO]: [
    AccountSubtype.ACTIVO_CORRIENTE,
    AccountSubtype.ACTIVO_NO_CORRIENTE,
  ],
  [AccountType.PASIVO]: [
    AccountSubtype.PASIVO_CORRIENTE,
    AccountSubtype.PASIVO_NO_CORRIENTE,
  ],
  [AccountType.PATRIMONIO]: [
    AccountSubtype.PATRIMONIO_CAPITAL,
    AccountSubtype.PATRIMONIO_RESULTADOS,
  ],
  [AccountType.INGRESO]: [
    AccountSubtype.INGRESO_OPERATIVO,
    AccountSubtype.INGRESO_NO_OPERATIVO,
  ],
  [AccountType.GASTO]: [
    AccountSubtype.GASTO_OPERATIVO,
    AccountSubtype.GASTO_ADMINISTRATIVO,
    AccountSubtype.GASTO_FINANCIERO,
    AccountSubtype.GASTO_NO_OPERATIVO,
  ],
};

/**
 * Verifica si un subtipo es válido para un tipo de cuenta dado.
 * Basado en la matriz NIIF/PCGA hardcodeada en SUBTYPES_BY_TYPE.
 */
export function isValidSubtypeForType(
  type: AccountType,
  subtype: AccountSubtype,
): boolean {
  return SUBTYPES_BY_TYPE[type].includes(subtype);
}

/**
 * Mapa de código de nivel 2 → AccountSubtype.
 * Derivado del seed estándar boliviano (plan de cuentas PCGA/NIIF).
 * Los códigos de nivel 2 son el segundo segmento del árbol de cuentas (ej: "1.1", "2.1").
 */
const CODE_LEVEL2_TO_SUBTYPE: Record<string, AccountSubtype> = {
  "1.1": AccountSubtype.ACTIVO_CORRIENTE,
  "1.2": AccountSubtype.ACTIVO_NO_CORRIENTE,
  "2.1": AccountSubtype.PASIVO_CORRIENTE,
  "2.2": AccountSubtype.PASIVO_NO_CORRIENTE,
  "3.1": AccountSubtype.PATRIMONIO_CAPITAL,
  "3.2": AccountSubtype.PATRIMONIO_RESULTADOS,
  "4.1": AccountSubtype.INGRESO_OPERATIVO,
  "4.2": AccountSubtype.INGRESO_NO_OPERATIVO,
  "5.1": AccountSubtype.GASTO_OPERATIVO,
  "5.2": AccountSubtype.GASTO_ADMINISTRATIVO,
  "5.3": AccountSubtype.GASTO_FINANCIERO,
};

/**
 * Extrae el código de nivel 2 de un código de cuenta.
 * Ejemplos:
 *   "1.1"     → "1.1"   (ya es nivel 2)
 *   "1.1.3"   → "1.1"   (toma los primeros dos segmentos)
 *   "1.1.3.1" → "1.1"   (idem)
 *   "1"       → null    (nivel 1, no tiene nivel 2)
 */
function extractLevel2Code(code: string): string | null {
  const segments = code.split(".");
  if (segments.length < 2) return null; // nivel 1 (raíz estructural)
  return `${segments[0]}.${segments[1]}`;
}

/**
 * Infiere el AccountSubtype a partir del código de la cuenta, el código del padre,
 * el nombre y el tipo. Usa el mapa fijo de códigos nivel 2.
 *
 * Retorna null si:
 * - El código es de nivel 1 (cuenta raíz estructural).
 * - El código de nivel 2 no tiene mapeo conocido.
 *
 * @param code       Código de la cuenta (ej: "1.1.3")
 * @param _name      Nombre de la cuenta (no usado en la heurística actual, reservado)
 * @param parentCode Código del padre directo (ej: "1.1"), o null si es raíz
 * @param _type      Tipo de cuenta (no usado en la heurística actual, reservado)
 */
export function inferSubtype(
  code: string,
  _name: string,
  parentCode: string | null,
  _type: AccountType,
): AccountSubtype | null {
  // Usar parentCode solo si este tiene nivel ≥ 2 (contiene un punto),
  // ya que es más directo para resolver el nivel 2 sin depender del formato del código.
  // Para cuentas de nivel 2 (parentCode es nivel 1, sin punto), usar el propio code.
  const parentEsNivel2oMas = parentCode !== null && parentCode.includes(".");
  const referenceCode = parentEsNivel2oMas ? parentCode : code;
  const level2 = extractLevel2Code(referenceCode);

  if (!level2) return null;

  return CODE_LEVEL2_TO_SUBTYPE[level2] ?? null;
}
