export const OPERATIONAL_DOC_DIRECTIONS = ["COBRO", "PAGO", "BOTH"] as const;

export type OperationalDocDirection = (typeof OPERATIONAL_DOC_DIRECTIONS)[number];
