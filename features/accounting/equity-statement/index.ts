/**
 * Client-safe barrel — re-exports only types and serialized shapes.
 * NO server imports here (no repository, no service, no server-only).
 */
export type {
  Decimal,
  ColumnKey,
  RowKey,
  EquityCell,
  EquityRow,
  EquityColumn,
  EquityColumnTotals,
  EquityStatement,
  BuildEquityStatementInput,
  EquityAccountMetadata,
  SerializedEquityCell,
  SerializedEquityRow,
  SerializedEquityStatement,
} from "./equity-statement.types";
