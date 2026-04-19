import type { OrgProfile } from "@/generated/prisma/client";
import type { UpdateOrgProfileInput as UpdateOrgProfileInputFromSchema } from "./org-profile.validation";

export type { OrgProfile };

/** Input accepted by OrgProfileService.update — mirrors the zod schema. */
export type UpdateOrgProfileInput = UpdateOrgProfileInputFromSchema;
