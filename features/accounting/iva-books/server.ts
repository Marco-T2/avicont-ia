/**
 * Server-only barrel for iva-books module.
 * Import this from route handlers and server components ONLY.
 * Client components should import from ./index (types + validation only).
 */
import "server-only";

export { IvaBooksService } from "./iva-books.service";
export { IvaBooksRepository } from "./iva-books.repository";
export { exportIvaBookExcel } from "./exporters/excel.exporter";
