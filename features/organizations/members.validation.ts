import { z } from "zod";

const assignableRoles = ["member", "contador", "admin"] as const;

export const addMemberSchema = z.object({
  email: z.string().email("Email inválido"),
  role: z.enum(assignableRoles, {
    message: "Rol inválido. Debe ser: member, contador o admin",
  }),
});

export const updateRoleSchema = z.object({
  role: z.enum(assignableRoles, {
    message: "Rol inválido. Debe ser: member, contador o admin",
  }),
});

export type AddMemberDto = z.infer<typeof addMemberSchema>;
export type UpdateRoleDto = z.infer<typeof updateRoleSchema>;
