// DTO local — define el shape mínimo que `org-settings` necesita de una cuenta
// para validar referencias en defaultCashAccountIds / defaultBankAccountIds.
// Definirlo acá (no importar la entity Account de accounting) evita acoplar este
// módulo al modelo de dominio del módulo accounting cuando éste migre. El
// adapter (LegacyAccountLookupAdapter hoy, port hexagonal cuando accounting
// migre) es el responsable de mapear su modelo interno a este DTO.
export interface AccountReference {
  id: string;
  code: string;
  isDetail: boolean;
  isActive: boolean;
}

export interface AccountLookupPort {
  findManyByIds(
    organizationId: string,
    ids: string[],
  ): Promise<AccountReference[]>;
}
