/** R5 absoluta — local types, ZERO Prisma imports. */

export interface OrgProfileProps {
  id: string;
  organizationId: string;
  razonSocial: string;
  nit: string;
  direccion: string;
  ciudad: string;
  telefono: string;
  representanteLegal: string;
  nroPatronal: string | null;
  logoUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateOrgProfileInput {
  razonSocial?: string;
  nit?: string;
  direccion?: string;
  ciudad?: string;
  telefono?: string;
  representanteLegal?: string;
  nroPatronal?: string | null;
  logoUrl?: string | null;
}

export interface OrgProfileSnapshot {
  id: string;
  organizationId: string;
  razonSocial: string;
  nit: string;
  direccion: string;
  ciudad: string;
  telefono: string;
  representanteLegal: string;
  nroPatronal: string | null;
  logoUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class OrgProfile {
  private constructor(private readonly props: OrgProfileProps) {}

  static create(organizationId: string): OrgProfile {
    const now = new Date();
    return new OrgProfile({
      id: crypto.randomUUID(),
      organizationId,
      razonSocial: "",
      nit: "",
      direccion: "",
      ciudad: "",
      telefono: "",
      representanteLegal: "",
      nroPatronal: null,
      logoUrl: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromPersistence(props: OrgProfileProps): OrgProfile {
    return new OrgProfile(props);
  }

  get id(): string {
    return this.props.id;
  }
  get organizationId(): string {
    return this.props.organizationId;
  }
  get razonSocial(): string {
    return this.props.razonSocial;
  }
  get nit(): string {
    return this.props.nit;
  }
  get direccion(): string {
    return this.props.direccion;
  }
  get ciudad(): string {
    return this.props.ciudad;
  }
  get telefono(): string {
    return this.props.telefono;
  }
  get representanteLegal(): string {
    return this.props.representanteLegal;
  }
  get nroPatronal(): string | null {
    return this.props.nroPatronal;
  }
  get logoUrl(): string | null {
    return this.props.logoUrl;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  applyUpdate(input: UpdateOrgProfileInput): void {
    if (input.razonSocial !== undefined)
      (this.props as { razonSocial: string }).razonSocial = input.razonSocial;
    if (input.nit !== undefined)
      (this.props as { nit: string }).nit = input.nit;
    if (input.direccion !== undefined)
      (this.props as { direccion: string }).direccion = input.direccion;
    if (input.ciudad !== undefined)
      (this.props as { ciudad: string }).ciudad = input.ciudad;
    if (input.telefono !== undefined)
      (this.props as { telefono: string }).telefono = input.telefono;
    if (input.representanteLegal !== undefined)
      (this.props as { representanteLegal: string }).representanteLegal =
        input.representanteLegal;
    if (input.nroPatronal !== undefined)
      (this.props as { nroPatronal: string | null }).nroPatronal =
        input.nroPatronal;
    if (input.logoUrl !== undefined)
      (this.props as { logoUrl: string | null }).logoUrl = input.logoUrl;
    (this.props as { updatedAt: Date }).updatedAt = new Date();
  }

  toSnapshot(): OrgProfileSnapshot {
    return {
      id: this.props.id,
      organizationId: this.props.organizationId,
      razonSocial: this.props.razonSocial,
      nit: this.props.nit,
      direccion: this.props.direccion,
      ciudad: this.props.ciudad,
      telefono: this.props.telefono,
      representanteLegal: this.props.representanteLegal,
      nroPatronal: this.props.nroPatronal,
      logoUrl: this.props.logoUrl,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
    };
  }
}
