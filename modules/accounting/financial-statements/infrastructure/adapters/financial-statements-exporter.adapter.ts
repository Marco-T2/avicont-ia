import type {
  FinancialStatementsExporterPort,
  FinancialStatementsOrgHeader,
} from "../../domain/ports/financial-statements-exporter.port";
import type { BalanceSheet, IncomeStatement } from "../../domain/types/financial-statements.types";
import { exportBalanceSheetPdf, exportIncomeStatementPdf } from "../exporters/pdf.exporter";
import { exportBalanceSheetExcel, exportIncomeStatementExcel } from "../exporters/excel.exporter";

/**
 * Adapter for `FinancialStatementsExporterPort`. Thin delegation to the
 * EXISTING pure exporter functions (left UNCHANGED). [EXPORT] cluster
 * paydown. UNLIKE its 6 sisters, these 4 exporters already return a plain
 * `Buffer` — no Result-unwrapping needed here.
 */
export class FinancialStatementsExporterAdapter implements FinancialStatementsExporterPort {
  async exportBalanceSheetPdf(bs: BalanceSheet, org: FinancialStatementsOrgHeader): Promise<Buffer> {
    return exportBalanceSheetPdf(bs, org);
  }

  async exportBalanceSheetXlsx(bs: BalanceSheet, org: FinancialStatementsOrgHeader): Promise<Buffer> {
    return exportBalanceSheetExcel(bs, org);
  }

  async exportIncomeStatementPdf(is: IncomeStatement, org: FinancialStatementsOrgHeader): Promise<Buffer> {
    return exportIncomeStatementPdf(is, org);
  }

  async exportIncomeStatementXlsx(is: IncomeStatement, org: FinancialStatementsOrgHeader): Promise<Buffer> {
    return exportIncomeStatementExcel(is, org);
  }
}
