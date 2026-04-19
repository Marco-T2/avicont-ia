import { z } from "zod";

/**
 * Zod schema for PATCH /api/organizations/[orgSlug]/profile.
 *
 * All fields are optional so partial updates are supported (REQ-OP.1).
 * Required-when-present rules (REQ-OP.2):
 *   razonSocial | nit | direccion | ciudad | telefono: non-empty after trim, max length
 *   nroPatronal: optional + nullable, max 50
 *   logoUrl:     optional + nullable, must be valid URL
 */
export const updateOrgProfileSchema = z.object({
  razonSocial: z.string().trim().min(1).max(200).optional(),
  nit: z.string().trim().min(1).max(50).optional(),
  direccion: z.string().trim().min(1).max(300).optional(),
  ciudad: z.string().trim().min(1).max(100).optional(),
  telefono: z.string().trim().min(1).max(100).optional(),
  nroPatronal: z.string().trim().max(50).optional().nullable(),
  logoUrl: z
    .string()
    .regex(
      /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/.+$/i,
      "logoUrl debe ser una URL de Vercel Blob (*.public.blob.vercel-storage.com)",
    )
    .optional()
    .nullable(),
});

export type UpdateOrgProfileInput = z.infer<typeof updateOrgProfileSchema>;

/**
 * Server-side constraints for the logo upload endpoint (REQ-OP.3).
 * D4: 2 MB max, allow png/jpeg/webp/svg+xml.
 */
export const logoUploadConstraints = {
  maxBytes: 2 * 1024 * 1024,
  allowedMimes: [
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/svg+xml",
  ] as const,
} as const;
