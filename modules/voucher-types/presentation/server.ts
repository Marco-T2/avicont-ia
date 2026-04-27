import "server-only";

export {
  makeVoucherTypesService,
  makeVoucherTypesServiceForTx,
} from "./composition-root";
export {
  createVoucherTypeSchema,
  updateVoucherTypeSchema,
} from "./voucher-type.validation";

// Domain re-exports for server callers (entity, VOs, errors, port).
export { VoucherType } from "../domain/voucher-type.entity";
export type {
  VoucherTypeProps,
  VoucherTypeSnapshot,
  CreateVoucherTypeInput,
} from "../domain/voucher-type.entity";
export { VoucherTypeCode } from "../domain/value-objects/voucher-type-code";
export { VoucherTypePrefix } from "../domain/value-objects/voucher-type-prefix";
export type {
  VoucherTypeRepository,
  ListVoucherTypesOptions,
} from "../domain/voucher-type.repository";
export {
  VoucherTypeCodeDuplicate,
  VoucherTypeNotInOrg,
  InvalidVoucherTypeCodeFormat,
  InvalidVoucherTypePrefixFormat,
  INVALID_VOUCHER_TYPE_CODE_FORMAT,
  INVALID_VOUCHER_TYPE_PREFIX_FORMAT,
  VOUCHER_TYPE_CODE_DUPLICATE,
  VOUCHER_TYPE_NOT_IN_ORG,
} from "../domain/errors/voucher-type-errors";

