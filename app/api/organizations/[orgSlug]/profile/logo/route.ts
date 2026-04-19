import { put } from "@vercel/blob";
import { handleError } from "@/features/shared/middleware";
import { AppError } from "@/features/shared/errors";
import { requirePermission } from "@/features/shared/permissions.server";
import { OrgProfileService } from "@/features/org-profile/server";
import { logoUploadConstraints } from "@/features/org-profile";

/** 400 Bad Request — local helper used only by this route. */
class LogoUploadError extends AppError {
  constructor(message: string, code = "LOGO_UPLOAD_INVALID") {
    super(message, 400, code);
  }
}

const orgProfileService = new OrgProfileService();

/**
 * POST /api/organizations/[orgSlug]/profile/logo
 *
 * Multipart upload of the organization logo. REQ-OP.3.
 *
 * Validation order (REQ-OP.3):
 *   1. requirePermission (admin only)
 *   2. multipart parse → File
 *   3. MIME allowlist (logoUploadConstraints.allowedMimes)
 *   4. Byte-size cap (logoUploadConstraints.maxBytes)
 *   5. Vercel Blob put() with organization-scoped pathname
 *   6. service.updateLogo() — swaps URL + best-effort delete of previous blob
 *
 * Invalid MIME or oversize MUST be rejected BEFORE calling put() — we never
 * want to burn blob storage on rejected uploads.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { orgSlug } = await params;
    const { orgId } = await requirePermission(
      "accounting-config",
      "write",
      orgSlug,
    );

    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      throw new LogoUploadError("Archivo no encontrado en el formulario");
    }

    const allowedMimes = logoUploadConstraints.allowedMimes as readonly string[];
    if (!allowedMimes.includes(file.type)) {
      throw new LogoUploadError(
        `Tipo de archivo no permitido: ${file.type}. Permitidos: ${allowedMimes.join(", ")}`,
      );
    }

    if (file.size > logoUploadConstraints.maxBytes) {
      const maxMb = (logoUploadConstraints.maxBytes / (1024 * 1024)).toFixed(0);
      throw new LogoUploadError(
        `El archivo excede el tamaño máximo de ${maxMb} MB`,
      );
    }

    // Derive extension from MIME, fallback to filename extension, fallback to "bin"
    const extFromMime = file.type.split("/")[1]?.replace("+xml", "") ?? "bin";
    const pathname = `organizations/${orgId}/logo-${Date.now()}.${extFromMime}`;

    const blob = await put(pathname, file, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    await orgProfileService.updateLogo(orgId, blob.url);

    return Response.json({ url: blob.url });
  } catch (error) {
    return handleError(error);
  }
}
