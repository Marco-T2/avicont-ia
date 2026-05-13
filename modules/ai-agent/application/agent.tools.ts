/**
 * Tool executor router (application layer).
 * The Zod tool DEFINITIONS live in domain/tools/agent.tool-definitions.ts;
 * the routing/dispatching logic stays in application because it composes
 * use cases against injected ports.
 *
 * Per design D8: definitions (domain) vs executors (application) split.
 */
export {
  TOOL_REGISTRY,
  getToolsForRole,
  isWriteAction,
  createExpenseTool,
  logMortalityTool,
  getLotSummaryTool,
  listFarmsTool,
  listLotsTool,
  searchDocumentsTool,
  journalEntryAiTools,
  parseAccountingOperationToSuggestionTool,
} from "../domain/tools/agent.tool-definitions";
