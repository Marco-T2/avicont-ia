import "server-only";
// SHIM — canonical home relocated to modules/documents/ as part of
// poc-documents-hex. Existing consumers + vi.mock targets preserved via
// re-export chain. C5 wholesale delete deferred until poc-rag-hex closes
// (rag/ subfolder still resident in features/documents/).
export * from "@/modules/documents/presentation/server";
