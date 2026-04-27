// Isomorphic barrel — safe for client and server. Anything that requires
// server-only state (Prisma, composition root) lives in `./server`.

export {
  createVoucherTypeSchema,
  updateVoucherTypeSchema,
} from "./voucher-type.validation";
