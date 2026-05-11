import type { OperationalDocDirection } from "./value-objects/operational-doc-direction";

export interface OperationalDocTypeProps {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  direction: OperationalDocDirection;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOperationalDocTypeInput {
  organizationId: string;
  code: string;
  name: string;
  direction: OperationalDocDirection;
}

export interface OperationalDocTypeSnapshot {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  direction: OperationalDocDirection;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class OperationalDocType {
  private constructor(private readonly props: OperationalDocTypeProps) {}

  static create(input: CreateOperationalDocTypeInput): OperationalDocType {
    const now = new Date();
    return new OperationalDocType({
      id: crypto.randomUUID(),
      organizationId: input.organizationId,
      code: input.code,
      name: input.name,
      direction: input.direction,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromPersistence(props: OperationalDocTypeProps): OperationalDocType {
    return new OperationalDocType(props);
  }

  get id(): string { return this.props.id; }
  get organizationId(): string { return this.props.organizationId; }
  get code(): string { return this.props.code; }
  get name(): string { return this.props.name; }
  get direction(): OperationalDocDirection { return this.props.direction; }
  get isActive(): boolean { return this.props.isActive; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  rename(name: string): void {
    (this.props as { name: string }).name = name;
    (this.props as { updatedAt: Date }).updatedAt = new Date();
  }

  changeDirection(direction: OperationalDocDirection): void {
    (this.props as { direction: OperationalDocDirection }).direction = direction;
    (this.props as { updatedAt: Date }).updatedAt = new Date();
  }

  deactivate(): void {
    (this.props as { isActive: boolean }).isActive = false;
    (this.props as { updatedAt: Date }).updatedAt = new Date();
  }

  toSnapshot(): OperationalDocTypeSnapshot {
    return {
      id: this.props.id,
      organizationId: this.props.organizationId,
      code: this.props.code,
      name: this.props.name,
      direction: this.props.direction,
      isActive: this.props.isActive,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
    };
  }
}
