// Tipos compartidos entre los componentes del modal de captura asistida.
// El shape principal (CreateJournalEntrySuggestion["data"]) viaja por reference
// desde el wire format del backend; lo re-aliasamos acá para no acoplar todos
// los componentes hijos a @/modules/ai-agent/domain/types/agent.types directamente.

import type { CreateJournalEntrySuggestion } from "@/modules/ai-agent/presentation/server";

export type SuggestionData = CreateJournalEntrySuggestion["data"];

// FSM del modal. Cada transición está descrita en el JSDoc del index.
export type ModalState =
  | { phase: "idle" }
  | { phase: "parsing" }
  | { phase: "ready"; data: SuggestionData; message: string }
  | { phase: "confirming"; data: SuggestionData }
  | { phase: "error"; message: string; previous?: SuggestionData };

// Catálogo precargado del backend (lo que usa el LLM y los dropdowns del form).
export interface CatalogAccount {
  id: string;
  code: string;
  name: string;
  isDefault?: boolean;
  requiresContact?: boolean;
}

export interface CatalogBundle {
  bank: CatalogAccount[];
  cash: CatalogAccount[];
  expense: CatalogAccount[];
  // Mapa flat para resolver { id → CatalogAccount } sin re-iterar
  byId: Map<string, CatalogAccount>;
}
