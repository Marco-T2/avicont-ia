import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../..");

// ── C5 RED paths operational-doc-type single-aggregate (6 source file existence transition, dir absorbed) ──

const ODT_SERVER_PATH = path.join(REPO_ROOT, "features/operational-doc-types/server.ts");
const ODT_INDEX_PATH = path.join(REPO_ROOT, "features/operational-doc-types/index.ts");
const ODT_TYPES_PATH = path.join(REPO_ROOT, "features/operational-doc-types/operational-doc-types.types.ts");
const ODT_VALIDATION_PATH = path.join(REPO_ROOT, "features/operational-doc-types/operational-doc-types.validation.ts");
const ODT_SERVICE_PATH = path.join(REPO_ROOT, "features/operational-doc-types/operational-doc-types.service.ts");
const ODT_REPOSITORY_PATH = path.join(REPO_ROOT, "features/operational-doc-types/operational-doc-types.repository.ts");

// ── PROJECT-scope absence regex (safety net consumer reintroducción) ──

const LEGACY_SERVER_IMPORT_RE = /from\s*["']@\/features\/operational-doc-types\/server["']/;
const LEGACY_BARREL_IMPORT_RE = /from\s*["']@\/features\/operational-doc-types["']/;

const PRODUCTION_SCAN_DIRS = ["app", "features", "modules"];

function walkProductionSources(dir: string): string[] {
  const collected: string[] = [];
  if (!fs.existsSync(dir)) return collected;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === "node_modules" ||
        entry.name === ".next" ||
        entry.name === ".turbo" ||
        entry.name === "__tests__"
      ) {
        continue;
      }
      collected.push(...walkProductionSources(full));
    } else if (
      entry.isFile() &&
      /\.(ts|tsx)$/.test(entry.name) &&
      !/\.(test|spec)\.tsx?$/.test(entry.name)
    ) {
      collected.push(full);
    }
  }
  return collected;
}

function findFilesMatchingImport(re: RegExp): string[] {
  const matches: string[] = [];
  for (const subdir of PRODUCTION_SCAN_DIRS) {
    const root = path.join(REPO_ROOT, subdir);
    const files = walkProductionSources(root);
    for (const file of files) {
      const source = fs.readFileSync(file, "utf8");
      if (re.test(source)) {
        matches.push(path.relative(REPO_ROOT, file));
      }
    }
  }
  return matches;
}

describe("POC operational-doc-type hex C5 — atomic delete features/operational-doc-types/ wholesale shape (paired sister expense C5 EXACT mirror)", () => {
  // ── Tests α51-α56: source files no longer exist (legacy wholesale deletion) ──

  // α51
  it("α51: features/operational-doc-types/server.ts no longer exists (legacy barrel deletion — OperationalDocTypesService resolved canonical home @/modules/operational-doc-type/presentation/server post-cutover C0-C4)", () => {
    expect(fs.existsSync(ODT_SERVER_PATH)).toBe(false);
  });

  // α52
  it("α52: features/operational-doc-types/index.ts no longer exists (legacy re-export barrel deletion — schemas zod absorbed canonical home @/modules/operational-doc-type/presentation/{server,validation})", () => {
    expect(fs.existsSync(ODT_INDEX_PATH)).toBe(false);
  });

  // α53
  it("α53: features/operational-doc-types/operational-doc-types.types.ts no longer exists (legacy types deletion — OperationalDocType + direction + inputs absorbed domain canonical home)", () => {
    expect(fs.existsSync(ODT_TYPES_PATH)).toBe(false);
  });

  // α54
  it("α54: features/operational-doc-types/operational-doc-types.validation.ts no longer exists (legacy zod schemas deletion — canonical home @/modules/operational-doc-type/presentation/validation)", () => {
    expect(fs.existsSync(ODT_VALIDATION_PATH)).toBe(false);
  });

  // α55
  it("α55: features/operational-doc-types/operational-doc-types.service.ts no longer exists (legacy OperationalDocTypesService class deletion — factory hex makeOperationalDocTypeService() consumed via composition-root post-cutover C4)", () => {
    expect(fs.existsSync(ODT_SERVICE_PATH)).toBe(false);
  });

  // α56
  it("α56: features/operational-doc-types/operational-doc-types.repository.ts no longer exists (legacy OperationalDocTypesRepository class deletion — canonical home @/modules/operational-doc-type/infrastructure/prisma-operational-doc-types.repository post-cutover C2)", () => {
    expect(fs.existsSync(ODT_REPOSITORY_PATH)).toBe(false);
  });

  // ── Tests α57-α58: PROJECT-scope absence safety net ──

  // α57
  it("α57: zero production source imports `from \"@/features/operational-doc-types/server\"` (PROJECT-scope safety net consumer reintroducción)", () => {
    const matches = findFilesMatchingImport(LEGACY_SERVER_IMPORT_RE);
    expect(matches).toEqual([]);
  });

  // α58
  it("α58: zero production source imports `from \"@/features/operational-doc-types\"` exact barrel (PROJECT-scope safety net consumer reintroducción)", () => {
    const matches = findFilesMatchingImport(LEGACY_BARREL_IMPORT_RE);
    expect(matches).toEqual([]);
  });
});
