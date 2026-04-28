import { describeUnitOfWorkContract } from "./unit-of-work.contract";
import { InMemoryUnitOfWork } from "./fakes/in-memory-unit-of-work";

describeUnitOfWorkContract("InMemoryUnitOfWork", () => new InMemoryUnitOfWork());
