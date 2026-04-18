import { z } from "zod";

const assignableRoles = [
  "admin",
  "contador",
  "cobrador",
  "auxiliar",
  "member",
] as const;

const ROLE_ERROR = "Rol inválido. Debe ser: admin, contador, cobrador, auxiliar o member";

export const addMemberSchema = z.object({
  email: z.string().email("Email inválido"),
  role: z.enum(assignableRoles, { message: ROLE_ERROR }),
});

export const updateRoleSchema = z.object({
  role: z.enum(assignableRoles, { message: ROLE_ERROR }),
});

export type AddMemberDto = z.infer<typeof addMemberSchema>;
export type UpdateRoleDto = z.infer<typeof updateRoleSchema>;
