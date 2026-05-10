export interface FarmProps {
  id: string;
  name: string;
  location: string | null;
  memberId: string;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateFarmInput {
  name: string;
  location?: string | null;
  memberId: string;
  organizationId: string;
}

export interface UpdateFarmInput {
  name?: string;
  location?: string | null;
}

export interface FarmSnapshot {
  id: string;
  name: string;
  location: string | null;
  memberId: string;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Farm {
  private constructor(private readonly props: FarmProps) {}

  static create(input: CreateFarmInput): Farm {
    const now = new Date();
    return new Farm({
      id: crypto.randomUUID(),
      name: input.name,
      location: input.location ?? null,
      memberId: input.memberId,
      organizationId: input.organizationId,
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromPersistence(props: FarmProps): Farm {
    return new Farm(props);
  }

  get id(): string { return this.props.id; }
  get name(): string { return this.props.name; }
  get location(): string | null { return this.props.location; }
  get memberId(): string { return this.props.memberId; }
  get organizationId(): string { return this.props.organizationId; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  update(input: UpdateFarmInput): Farm {
    const next: FarmProps = { ...this.props, updatedAt: new Date() };
    if (input.name !== undefined) next.name = input.name;
    if (input.location !== undefined) next.location = input.location;
    return new Farm(next);
  }

  toSnapshot(): FarmSnapshot {
    return {
      id: this.props.id,
      name: this.props.name,
      location: this.props.location,
      memberId: this.props.memberId,
      organizationId: this.props.organizationId,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
    };
  }
}
