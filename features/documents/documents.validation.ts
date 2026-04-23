import { z } from "zod";

const documentScopeEnum = z.enum(["ORGANIZATION", "ACCOUNTING", "FARM"]);

export const createDocumentSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  content: z.string().optional(),
  organizationId: z.string().min(1, "El ID de organización es requerido"),
  scope: documentScopeEnum.optional().default("ORGANIZATION"),
});

export const listDocumentsSchema = z.object({
  organizationId: z.string().min(1, "El ID de organización es requerido"),
});

export const analyzeDocumentSchema = z.object({
  documentId: z.string().min(1, "El ID del documento es requerido"),
  organizationId: z.string().min(1, "El ID de organización es requerido"),
  analysisType: z
    .enum(["summary", "qa", "sentiment", "entities", "extract"])
    .default("summary"),
});

