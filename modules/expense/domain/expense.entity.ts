import type { ExpenseCategory } from "./value-objects/expense-category";

export interface ExpenseProps {
  id: string;
  amount: number;
  category: ExpenseCategory;
  description: string | null;
  date: Date;
  lotId: string;
  organizationId: string;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateExpenseInput {
  amount: number;
  category: ExpenseCategory;
  description?: string;
  date: Date;
  lotId: string;
  organizationId: string;
  createdById: string;
}

export interface UpdateExpenseInput {
  amount?: number;
  category?: ExpenseCategory;
  date?: Date;
  /** undefined keeps the prior value; null clears it. */
  description?: string | null;
}

export interface ExpenseSnapshot {
  id: string;
  amount: number;
  category: ExpenseCategory;
  description: string | null;
  date: Date;
  lotId: string;
  organizationId: string;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Expense {
  private constructor(private readonly props: ExpenseProps) {}

  static create(input: CreateExpenseInput): Expense {
    const now = new Date();
    return new Expense({
      id: crypto.randomUUID(),
      amount: input.amount,
      category: input.category,
      description: input.description ?? null,
      date: input.date,
      lotId: input.lotId,
      organizationId: input.organizationId,
      createdById: input.createdById,
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromPersistence(props: ExpenseProps): Expense {
    return new Expense(props);
  }

  /**
   * Returns a new Expense reflecting the updated fields. `lotId`,
   * `organizationId`, `createdById`, `createdAt` are immutable
   * post-creation (INV-03). `updatedAt` advances to now() on every
   * call. Spec REQ-103 / REQ-104.
   *
   * `description === undefined` keeps the prior value; `description
   * === null` clears it explicitly.
   */
  update(input: UpdateExpenseInput): Expense {
    return new Expense({
      ...this.props,
      amount: input.amount ?? this.props.amount,
      category: input.category ?? this.props.category,
      date: input.date ?? this.props.date,
      description:
        input.description === undefined
          ? this.props.description
          : input.description,
      updatedAt: new Date(),
    });
  }

  get id(): string { return this.props.id; }
  get amount(): number { return this.props.amount; }
  get category(): ExpenseCategory { return this.props.category; }
  get description(): string | null { return this.props.description; }
  get date(): Date { return this.props.date; }
  get lotId(): string { return this.props.lotId; }
  get organizationId(): string { return this.props.organizationId; }
  get createdById(): string { return this.props.createdById; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  toSnapshot(): ExpenseSnapshot {
    return {
      id: this.props.id,
      amount: this.props.amount,
      category: this.props.category,
      description: this.props.description,
      date: this.props.date,
      lotId: this.props.lotId,
      organizationId: this.props.organizationId,
      createdById: this.props.createdById,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
    };
  }
}
