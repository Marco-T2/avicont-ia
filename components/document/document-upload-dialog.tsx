// components/document-upload-dialog.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { useOrganization, useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { allowedTypes } from "@/app/data/data";
import { getUploadScopes, type DocumentScope } from "@/features/permissions";

interface OrgTag {
  id: string;
  name: string;
  slug: string;
  color: string | null;
}

const SCOPE_LABELS: Record<DocumentScope, string> = {
  ORGANIZATION: "Organización",
  ACCOUNTING: "Contabilidad",
  FARM: "Granja",
};

interface DocumentUploadDialogProps {
  onUploadSuccess?: () => void;
  trigger?: React.ReactNode;
  userRole?: string;
}

export default function DocumentUploadDialog({
  onUploadSuccess,
  trigger,
  userRole,
}: DocumentUploadDialogProps) {
  const { organization } = useOrganization();
  const { user } = useUser();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [documentName, setDocumentName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  // F5/REQ-45 — org-canonical tags state. Loaded once when the dialog opens
  // (avoids fetching on every page mount when no upload is in progress).
  const [orgTags, setOrgTags] = useState<OrgTag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  // Get allowed scopes for the user's role
  const allowedScopes = userRole ? getUploadScopes(userRole) : null;
  const [selectedScope, setSelectedScope] = useState<DocumentScope>(
    allowedScopes?.[0] ?? "ORGANIZATION",
  );

  // Fetch tags lazily on dialog open. Slug comes from Clerk Organization;
  // failures show a toast but don't block the upload flow.
  useEffect(() => {
    if (!isOpen || !organization?.slug) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/organizations/${organization.slug}/tags`,
        );
        if (!res.ok) throw new Error("tags fetch failed");
        const body = (await res.json()) as { tags: OrgTag[] };
        if (!cancelled) setOrgTags(body.tags ?? []);
      } catch (err) {
        console.error("tags fetch failed", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, organization?.slug]);

  const toggleTag = (id: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  // F5/REQ-45 item 3 — inline tag creation. Empty name + "already exists"
  // (matched case-insensitive against current list) short-circuit before
  // hitting the network. POST is fire-and-forget for UI purposes — on
  // success the returned tag is prepended + auto-selected; on 4xx we keep
  // the local state untouched so the user can correct and retry.
  const [newTagName, setNewTagName] = useState("");
  const [isCreatingTag, setIsCreatingTag] = useState(false);

  const handleCreateTag = async () => {
    if (!organization?.slug) return;
    const trimmed = newTagName.trim();
    if (!trimmed) return;
    const exists = orgTags.some(
      (t) => t.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (exists) {
      toast.error("Esa etiqueta ya existe");
      return;
    }
    setIsCreatingTag(true);
    try {
      const res = await fetch(`/api/organizations/${organization.slug}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(body.error || "No se pudo crear la etiqueta");
        return;
      }
      const body = (await res.json()) as { tag: OrgTag };
      setOrgTags((prev) => [body.tag, ...prev]);
      setSelectedTagIds((prev) =>
        prev.includes(body.tag.id) ? prev : [...prev, body.tag.id],
      );
      setNewTagName("");
    } catch (err) {
      console.error("create tag failed", err);
      toast.error("Error al crear la etiqueta");
    } finally {
      setIsCreatingTag(false);
    }
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("El archivo debe pesar menos de 10MB");
      return;
    }

    if (!allowedTypes.includes(file.type)) {
      toast.error(
        "Tipo de archivo no soportado. Por favor subí archivos .txt, .pdf, .doc, .docx o .md",
      );
      return;
    }

    setSelectedFile(file);
    setDocumentName(file.name.replace(/\.[^/.]+$/, "")); // Remove extension
  };

  // Handle upload
  const handleUpload = async () => {
    if (!organization || !user || !selectedFile) {
      toast.error("Por favor seleccioná un archivo");
      return;
    }

    if (!documentName.trim()) {
      toast.error("Por favor ingresá un nombre para el documento");
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append("name", documentName);
    formData.append("organizationId", organization.id);
    formData.append("scope", selectedScope);
    // F5/REQ-45 — tagIds shipped as JSON to keep FormData arity flat (no
    // .append per item ambiguity). Server route parses back to string[] via
    // a Zod array schema. Empty selection is omitted to keep the body minimal.
    if (selectedTagIds.length > 0) {
      formData.append("tagIds", JSON.stringify(selectedTagIds));
    }

    if (selectedFile) {
      formData.append("file", selectedFile);
    }

    try {
      const response = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        toast.success("¡Documento subido exitosamente!");

        // Reset form
        setDocumentName("");
        setSelectedFile(null);
        setIsOpen(false);

        // Call success callback
        onUploadSuccess?.();
      } else {
        const error = await response.json();
        toast.error(error.error || "Error al subir el documento");
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Error al subir el documento");
    } finally {
      setIsUploading(false);
    }
  };

  // Reset form when dialog closes
  const handleDialogOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      // Reset form state
      setDocumentName("");
      setSelectedFile(null);
      setSelectedScope(allowedScopes?.[0] ?? "ORGANIZATION");
      setSelectedTagIds([]);
      setNewTagName("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Upload className="h-4 w-4 mr-2" />
            Subir Documento
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Subir Documento</DialogTitle>
          <DialogDescription>
            Subí un archivo o ingresá texto para analizar
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Nombre del Documento *
            </label>
            <Input
              placeholder="Ingresá el nombre del documento"
              value={documentName}
              onChange={(e) => setDocumentName(e.target.value)}
              disabled={isUploading}
            />
          </div>

          {/* Scope Selector */}
          {allowedScopes && allowedScopes.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Alcance del Documento *
              </label>
              <Select
                value={selectedScope}
                onValueChange={(value: string) =>
                  setSelectedScope(value as DocumentScope)
                }
                disabled={isUploading}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccioná el alcance" />
                </SelectTrigger>
                <SelectContent>
                  {allowedScopes.map((scope) => (
                    <SelectItem key={scope} value={scope}>
                      {SCOPE_LABELS[scope]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Define quién puede ver este documento en consultas al agente
              </p>
            </div>
          )}

          {/* F5/REQ-45 — Tag MultiSelect (org-canonical) */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Etiquetas
            </label>
            <div className="flex flex-wrap gap-2 border rounded-md p-2 min-h-[2.5rem]">
              {orgTags.length === 0 && (
                <span className="text-xs text-muted-foreground">
                  No hay etiquetas en esta organización.
                </span>
              )}
              {orgTags.map((tag) => {
                const isSelected = selectedTagIds.includes(tag.id);
                return (
                  <Badge
                    key={tag.id}
                    variant={isSelected ? "default" : "outline"}
                    className="cursor-pointer select-none"
                    onClick={() => toggleTag(tag.id)}
                    data-testid={`tag-option-${tag.slug}`}
                  >
                    {tag.name}
                  </Badge>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Hacé clic para seleccionar las etiquetas que aplican al documento.
            </p>
            <div className="flex gap-2 mt-2">
              <Input
                placeholder="Nueva etiqueta"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                disabled={isUploading || isCreatingTag}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleCreateTag}
                disabled={isUploading || isCreatingTag || newTagName.trim().length === 0}
              >
                {isCreatingTag ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>Crear «{newTagName.trim() || "…"}»</>
                )}
              </Button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Subir Archivo
            </label>
            <div className="border-2 border-dashed rounded-lg p-6 text-center">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept=".txt,.pdf,.doc,.docx,.md"
                className="hidden"
                id="file-upload"
                disabled={isUploading}
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-8 w-8 text-gray-400" />
                  <span className="font-medium">
                    {selectedFile ? selectedFile.name : "Hacé clic para seleccionar un archivo"}
                  </span>
                  <span className="text-sm text-gray-500">
                    Soporta: .txt, .pdf, .doc, .docx, .md (Máx 10MB)
                  </span>
                  {selectedFile && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = "";
                        }
                      }}
                    >
                      <X className="h-3 w-3 mr-1" />
                      Eliminar
                    </Button>
                  )}
                </div>
              </label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={isUploading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleUpload}
            disabled={isUploading || !documentName.trim()}
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Subiendo...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Subir Documento
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}