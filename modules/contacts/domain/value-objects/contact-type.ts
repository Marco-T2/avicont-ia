import { InvalidContactType } from "../errors/contact-errors";

export const CONTACT_TYPES = [
  "CLIENTE",
  "PROVEEDOR",
  "SOCIO",
  "TRANSPORTISTA",
  "OTRO",
] as const;

export type ContactType = (typeof CONTACT_TYPES)[number];

const VALID_SET = new Set<string>(CONTACT_TYPES);

export function parseContactType(value: unknown): ContactType {
  if (typeof value !== "string" || !VALID_SET.has(value)) {
    throw new InvalidContactType(String(value));
  }
  return value as ContactType;
}
