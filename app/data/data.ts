// Scope-locked 2026-05-17: PDF + DOCX + TXT only. XLSX + imágenes
// retirados — Excel para tablas/números va por páginas dedicadas;
// imágenes sin OCR no aportan al RAG.
export const allowedTypes = [
  "text/plain",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

// Format file size
export const formatFileSize = (bytes?: number) => {
  if (!bytes) return "N/A";
  if (bytes < 1024) return bytes + " bytes";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
};
