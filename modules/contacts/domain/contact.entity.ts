import { ContactType, parseContactType } from "./value-objects/contact-type";
import { Nit } from "./value-objects/nit";
import { PaymentTermsDays } from "./value-objects/payment-terms-days";
import { CreditLimit } from "./value-objects/credit-limit";

export interface ContactProps {
  id: string;
  organizationId: string;
  type: ContactType;
  name: string;
  nit: Nit | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  paymentTermsDays: PaymentTermsDays;
  creditLimit: CreditLimit | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateContactInput {
  organizationId: string;
  type: ContactType;
  name: string;
  nit?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  paymentTermsDays?: number;
  creditLimit?: number | null;
}

export interface UpdateContactInput {
  type?: ContactType;
  name?: string;
  nit?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  paymentTermsDays?: number;
  creditLimit?: number | null;
}

export interface ContactSnapshot {
  id: string;
  organizationId: string;
  type: ContactType;
  name: string;
  nit: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  paymentTermsDays: number;
  creditLimit: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function normalizeOptionalString(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function buildNit(raw: string | null | undefined): Nit | null {
  if (raw === undefined || raw === null) return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  return Nit.of(raw);
}

function buildCreditLimit(raw: number | null | undefined): CreditLimit | null {
  if (raw === undefined || raw === null) return null;
  return CreditLimit.of(raw);
}

export class Contact {
  private constructor(private readonly props: ContactProps) {}

  static create(input: CreateContactInput): Contact {
    const now = new Date();
    return new Contact({
      id: crypto.randomUUID(),
      organizationId: input.organizationId,
      type: parseContactType(input.type),
      name: input.name,
      nit: buildNit(input.nit),
      email: normalizeOptionalString(input.email),
      phone: normalizeOptionalString(input.phone),
      address: normalizeOptionalString(input.address),
      paymentTermsDays:
        input.paymentTermsDays !== undefined
          ? PaymentTermsDays.of(input.paymentTermsDays)
          : PaymentTermsDays.default(),
      creditLimit: buildCreditLimit(input.creditLimit),
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromPersistence(props: ContactProps): Contact {
    return new Contact(props);
  }

  get id(): string { return this.props.id; }
  get organizationId(): string { return this.props.organizationId; }
  get type(): ContactType { return this.props.type; }
  get name(): string { return this.props.name; }
  get nit(): string | null { return this.props.nit?.value ?? null; }
  get email(): string | null { return this.props.email; }
  get phone(): string | null { return this.props.phone; }
  get address(): string | null { return this.props.address; }
  get paymentTermsDays(): number { return this.props.paymentTermsDays.value; }
  get creditLimit(): number | null { return this.props.creditLimit?.value ?? null; }
  get isActive(): boolean { return this.props.isActive; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  update(input: UpdateContactInput): Contact {
    const next: ContactProps = { ...this.props };

    if (input.type !== undefined) next.type = parseContactType(input.type);
    if (input.name !== undefined) next.name = input.name;
    if ("nit" in input) next.nit = buildNit(input.nit);
    if ("email" in input) next.email = normalizeOptionalString(input.email);
    if ("phone" in input) next.phone = normalizeOptionalString(input.phone);
    if ("address" in input) next.address = normalizeOptionalString(input.address);
    if (input.paymentTermsDays !== undefined) {
      next.paymentTermsDays = PaymentTermsDays.of(input.paymentTermsDays);
    }
    if ("creditLimit" in input) next.creditLimit = buildCreditLimit(input.creditLimit);

    return new Contact(next);
  }

  deactivate(): Contact {
    return new Contact({ ...this.props, isActive: false });
  }

  toSnapshot(): ContactSnapshot {
    return {
      id: this.props.id,
      organizationId: this.props.organizationId,
      type: this.props.type,
      name: this.props.name,
      nit: this.props.nit?.value ?? null,
      email: this.props.email,
      phone: this.props.phone,
      address: this.props.address,
      paymentTermsDays: this.props.paymentTermsDays.value,
      creditLimit: this.props.creditLimit?.value ?? null,
      isActive: this.props.isActive,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
    };
  }
}
