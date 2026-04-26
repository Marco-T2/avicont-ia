// Barrel para las tools del modo "captura asistida de asientos contables".
// El modo journal-entry-ai del agente expone EXACTAMENTE estas tres tools al LLM
// (no las socio-tools ni searchDocuments). El dispatch por modo vive en
// agent.tools.ts (commit posterior).

export {
  findAccountsByPurposeTool,
  executeFindAccountsByPurpose,
  type FindAccountsResult,
  type FindAccountsResultItem,
  type FindAccountsByPurposeDeps,
} from "./find-accounts";

export {
  findContactTool,
  executeFindContact,
  type FindContactResult,
  type FindContactResultItem,
  type FindContactDeps,
} from "./find-contact";

export {
  parseAccountingOperationToSuggestionTool,
  executeParseAccountingOperation,
  type ParseAccountingOperationDeps,
} from "./parse-operation";
