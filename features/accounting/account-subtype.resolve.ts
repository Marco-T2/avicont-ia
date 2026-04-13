import { AccountType, AccountSubtype } from "@/generated/prisma/client";
import { ValidationError, INVALID_ACCOUNT_SUBTYPE, ACCOUNT_SUBTYPE_MISMATCH } from "@/features/shared/errors";
import { isValidSubtypeForType } from "./account-subtype.utils";

/**
 * Parámetros para resolver el subtipo de una cuenta.
 */
export interface ResolveAccountSubtypeParams {
  /** Subtipo enviado por el caller (puede ser undefined si no se provee). */
  inputSubtype: AccountSubtype | undefined;
  /** Subtipo del padre resuelto (null si la cuenta es raíz o si el padre no tiene subtipo). */
  parentSubtype: AccountSubtype | null;
  /** Tipo de cuenta ya resuelto (heredado del padre o del input). */
  resolvedType: AccountType;
  /** Nivel de la cuenta (1 = raíz estructural, >= 2 = requiere subtipo). */
  level: number;
}

/**
 * Resuelve el subtipo de una cuenta aplicando las reglas de herencia y validación.
 *
 * Reglas de negocio:
 * 1. Si el caller provee un subtype Y existe padre con subtype diferente → ACCOUNT_SUBTYPE_MISMATCH.
 * 2. Si el caller provee un subtype que no es válido para el type resuelto → INVALID_ACCOUNT_SUBTYPE.
 * 3. Si el caller no provee subtype → se hereda del padre (puede quedar null si el padre no tiene).
 * 4. Si level >= 2 y el subtype resuelto sigue siendo null → INVALID_ACCOUNT_SUBTYPE.
 * 5. Si level === 1 → null es permitido (cuentas raíz estructurales no tienen subtipo obligatorio).
 *
 * @returns El AccountSubtype resuelto, o null para cuentas raíz nivel 1 sin subtipo.
 * @throws ValidationError con ACCOUNT_SUBTYPE_MISMATCH si hay conflicto con el padre.
 * @throws ValidationError con INVALID_ACCOUNT_SUBTYPE si el subtipo no es válido o falta.
 */
export function resolveAccountSubtype(params: ResolveAccountSubtypeParams): AccountSubtype | null {
  const { inputSubtype, parentSubtype, resolvedType, level } = params;

  if (inputSubtype !== undefined) {
    // El caller proveyó un subtype explícito.

    // Regla 1: si el padre tiene subtipo y el input difiere → mismatch
    if (parentSubtype !== null && inputSubtype !== parentSubtype) {
      throw new ValidationError(
        `El subtipo de la cuenta debe coincidir con el subtipo del padre (${parentSubtype})`,
        ACCOUNT_SUBTYPE_MISMATCH,
      );
    }

    // Regla 2: verificar que el subtype sea válido para el type resuelto
    if (!isValidSubtypeForType(resolvedType, inputSubtype)) {
      throw new ValidationError(
        `El subtipo '${inputSubtype}' no es válido para el tipo de cuenta '${resolvedType}'`,
        INVALID_ACCOUNT_SUBTYPE,
      );
    }

    return inputSubtype;
  }

  // El caller no proveyó subtype → heredar del padre
  const resolvedSubtype = parentSubtype ?? null;

  // Regla 4: cuentas de nivel >= 2 requieren subtipo
  if (level >= 2 && resolvedSubtype === null) {
    throw new ValidationError(
      "El subtipo de cuenta es requerido para cuentas de nivel 2 o superior",
      INVALID_ACCOUNT_SUBTYPE,
    );
  }

  // Regla 5: nivel 1 sin subtipo → null permitido
  return resolvedSubtype;
}
