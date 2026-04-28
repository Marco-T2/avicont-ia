import { LineSide } from "./value-objects/line-side";

export interface JournalLineProps {
  id: string;
  journalEntryId: string;
  accountId: string;
  side: LineSide;
  description: string | null;
  contactId: string | null;
  order: number;
}

export interface CreateJournalLineInput {
  journalEntryId: string;
  accountId: string;
  side: LineSide;
  description?: string | null;
  contactId?: string | null;
  order: number;
}

export interface JournalLineSnapshot {
  id: string;
  journalEntryId: string;
  accountId: string;
  debit: number;
  credit: number;
  description: string | null;
  contactId: string | null;
  order: number;
}

/**
 * Child entity of the Journal aggregate. I10 (no zero, no both-sides) is
 * encoded structurally in the LineSide VO — this entity composes it and adds
 * the line-specific identity and bookkeeping fields (id, accountId, order,
 * description, contactId).
 */
export class JournalLine {
  private constructor(private readonly props: JournalLineProps) {}

  static create(input: CreateJournalLineInput): JournalLine {
    return new JournalLine({
      id: crypto.randomUUID(),
      journalEntryId: input.journalEntryId,
      accountId: input.accountId,
      side: input.side,
      description: input.description ?? null,
      contactId: input.contactId ?? null,
      order: input.order,
    });
  }

  static fromPersistence(props: JournalLineProps): JournalLine {
    return new JournalLine(props);
  }

  get id(): string {
    return this.props.id;
  }

  get journalEntryId(): string {
    return this.props.journalEntryId;
  }

  get accountId(): string {
    return this.props.accountId;
  }

  get side(): LineSide {
    return this.props.side;
  }

  get description(): string | null {
    return this.props.description;
  }

  get contactId(): string | null {
    return this.props.contactId;
  }

  get order(): number {
    return this.props.order;
  }

  toSnapshot(): JournalLineSnapshot {
    return {
      id: this.props.id,
      journalEntryId: this.props.journalEntryId,
      accountId: this.props.accountId,
      debit: this.props.side.debit?.toNumber() ?? 0,
      credit: this.props.side.credit?.toNumber() ?? 0,
      description: this.props.description,
      contactId: this.props.contactId,
      order: this.props.order,
    };
  }
}
