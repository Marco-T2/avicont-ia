import { MortalityCount } from "./value-objects/mortality-count";
import { MortalityCountExceedsAlive } from "./errors/mortality-errors";

export interface MortalityRelations {
  lot: { name: string; barnNumber: number };
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
