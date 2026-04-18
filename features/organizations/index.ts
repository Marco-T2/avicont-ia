export { OrganizationsRepository } from "./organizations.repository";
export { OrganizationsService } from "./organizations.service";
export { MembersService } from "./members.service";
export { addMemberSchema, updateRoleSchema } from "./members.validation";
export type { AddMemberDto, UpdateRoleDto } from "./members.validation";
export type {
  CreateOrganizationInput,
  AddMemberInput,
  OrganizationWithMembers,
  SyncOrganizationResult,
} from "./organizations.types";

// Custom roles (PR4)
export { RolesRepository } from "./roles.repository";
export type {
  CreateCustomRoleInput,
  UpdateCustomRolePatch,
} from "./roles.repository";
export { RolesService } from "./roles.service";
export type {
  CreateRoleInput,
  UpdateRolePatch,
  CallerContext,
  RolesServiceDeps,
} from "./roles.service";
export {
  slugify,
  assertNotReserved,
  resolveUniqueSlug,
  RESERVED_SLUGS,
} from "./roles.validation";
