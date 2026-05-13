/**
 * Server-only barrel for iva-books module.
 * Import this from route handlers and server components ONLY.
 * Client components should import from ./index (types + validation only).
 */
import "server-only";

export { exportIvaBookExcel } from "@/modules/iva-books/infrastructure/exporters/iva-book-xlsx.exporter";
