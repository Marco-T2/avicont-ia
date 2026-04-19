"use client";

import { useRef, useState } from "react";
import { logoUploadConstraints } from "@/features/org-profile/org-profile.validation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload } from "lucide-react";

/**
 * LogoUploader — multipart POST to /api/organizations/[orgSlug]/profile/logo.
 *
 * REQ-OP.3, REQ-OP.10. On success, the server returns `{ url }` and this
 * component hands it back to the parent via `onLogoChange` so the parent can
 * update its in-memory profile snapshot.
 */
export interface LogoUploaderProps {
  orgSlug: string;
  currentLogoUrl: string | null;
  onLogoChange: (url: string) => void;
}

export function LogoUploader({
  orgSlug,
  currentLogoUrl,
  onLogoChange,
}: LogoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);

    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch(
        `/api/organizations/${orgSlug}/profile/logo`,
        {
          method: "POST",
          body: form,
        },
      );

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(
          (data && typeof data.error === "string" && data.error) ||
            "No se pudo subir el logo",
        );
        return;
      }

      if (data && typeof data.url === "string") {
        onLogoChange(data.url);
      }
    } catch {
      setError("No se pudo subir el logo");
    } finally {
      setUploading(false);
      // Reset input so selecting the same file again still triggers change
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const accept = logoUploadConstraints.allowedMimes.join(",");

  return (
    <div className="space-y-3">
      <Label>Logo de la empresa</Label>

      {currentLogoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={currentLogoUrl}
          alt="Logo actual"
          className="max-h-24 rounded border bg-white p-1"
          data-testid="logo-preview"
        />
      )}

      <div className="flex items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleChange}
          className="hidden"
          data-testid="logo-input"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          data-testid="logo-upload-button"
        >
          <Upload className="h-4 w-4 mr-2" />
          {uploading ? "Subiendo…" : "Subir logo"}
        </Button>
        <span className="text-xs text-muted-foreground">
          PNG / JPEG / WebP / SVG, máx{" "}
          {(logoUploadConstraints.maxBytes / (1024 * 1024)).toFixed(0)} MB
        </span>
      </div>

      {error && (
        <p className="text-xs text-destructive" data-testid="logo-upload-error">
          {error}
        </p>
      )}
    </div>
  );
}
