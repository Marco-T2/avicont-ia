import { MortalityCount } from "./value-objects/mortality-count";
import { MortalityCountExceedsAlive } from "./errors/mortality-errors";

/**
 * Hydrated relations shape for read views. Post simplify-lot-identifier
 * the bare `lot.name` + `lot.barnNumber` columns are gone — the relation
 * now exposes the pre-derived `lot.displayName` so consumers don't have
 * to re-format. Producer responsibility: the mortality mapper composes
 * displayName from `farmName + startDate` via `formatDateBO`, mirroring
 * Lot.entity#displayName so the two stay in lockstep.
 */
export interface MortalityRelations {
  lot: { displayName: string };
  createdBy: { name: string | null; email: string };
}

export interface MortalityProps {
  id: string;
  count: MortalityCount;
  cause: string | null;
  date: Date;
  lotId: string;
  createdById: string;
  organizationId: string;
  relations?: MortalityRelations;
}

export interface UpdateMortalityInput {
  count?: number;
  cause?: string | null;
  date?: Date;
  /** Alive count in the lot EXCLUDING this log's old count. Service computes. */
  aliveCountInLot: number;
}

export class Mortality {
  private constructor(private readonly props: MortalityProps) {}

  static log(input: {
    lotId: string;
    count: number;
    cause?: string;
    date: Date;
    createdById: string;
    organizationId: string;
    aliveCountInLot: number;
  }): Mortality {
    if (input.count > input.aliveCountInLot) {
      throw new MortalityCountExceedsAlive(input.aliveCountInLot);
    }
    return new Mortality({
      id: crypto.randomUUID(),
      count: MortalityCount.of(input.count),
      cause: input.cause ?? null,
      date: input.date,
      lotId: input.lotId,
      createdById: input.createdById,
      organizationId: input.organizationId,
    });
  }

  static fromPersistence(props: MortalityProps): Mortality {
    return new Mortality(props);
  }

  /**
   * Returns a new Mortality reflecting the updated fields. Caller MUST
   * provide `aliveCountInLot` already excluding THIS log's old count
   * (the service computes it). Throws MortalityCountExceedsAlive when
   * the new count breaks INV-01 (aliveCountInLot >= 0).
   *
   * `cause === undefined` keeps the prior value; `cause === null` clears.
   */
  update(input: UpdateMortalityInput): Mortality {
    const newCount = input.count ?? this.props.count.value;
    if (newCount > input.aliveCountInLot) {
      throw new MortalityCountExceedsAlive(input.aliveCountInLot);
    }
    return new Mortality({
      ...this.props,
      count: MortalityCount.of(newCount),
      cause:
        input.cause === undefined ? this.props.cause : input.cause,
      date: input.date ?? this.props.date,
    });
  }

  get id(): string { return this.props.id; }
  get count(): MortalityCount { return this.props.count; }
  get cause(): string | null { return this.props.cause; }
  get date(): Date { return this.props.date; }
  get lotId(): string { return this.props.lotId; }
  get createdById(): string { return this.props.createdById; }
  get organizationId(): string { return this.props.organizationId; }
  get relations(): MortalityRelations | undefined { return this.props.relations; }

  toJSON() {
    return {
      id: this.props.id,
      count: this.props.count.value,
      cause: this.props.cause,
      date: this.props.date,
      lotId: this.props.lotId,
      createdById: this.props.createdById,
      organizationId: this.props.organizationId,
      ...(this.props.relations
        ? { lot: this.props.relations.lot, createdBy: this.props.relations.createdBy }
        : {}),
    };
  }
}
