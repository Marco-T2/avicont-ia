export type OrgProfileSnapshot = {
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
};

export interface OrgProfileInquiryPort {
  getOrCreate(organizationId: string): Promise<OrgProfileSnapshot>;
}
