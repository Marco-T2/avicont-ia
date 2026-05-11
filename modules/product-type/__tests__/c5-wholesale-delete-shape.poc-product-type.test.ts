import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../..");

// ── C5 RED paths product-type single-aggregate (6 source file existence transition, dir absorbed) ──

const PT_SERVER_PATH = path.join(REPO_ROOT, "features/product-types/server.ts");
const PT_INDEX_PATH = path.join(REPO_ROOT, "features/product-types/index.ts");
const PT_TYPES_PATH = path.join(REPO_ROOT, "features/product-types/product-types.types.ts");
const PT_VALIDATION_PATH = path.join(REPO_ROOT, "features/product-types/product-types.validation.ts");
const PT_SERVICE_PATH = path.join(REPO_ROOT, "features/product-types/product-types.service.ts");
const PT_REPOSITORY_PATH = path.join(REPO_ROOT, "features/product-types/product-types.repository.ts");

// ── PROJECT-scope absence regex (safety net consumer reintroducción) ──

const LEGACY_SERVER_IMPORT_RE = /from\s*["']@\/features\/product-types\/server["']/;
const LEGACY_BARREL_IMPORT_RE = /from\s*["']@\/features\/product-types["']/;

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

describe("POC product-type hex C5 — atomic delete features/product-types/ wholesale shape (paired sister operational-doc-type C5 EXACT mirror)", () => {
  // ── Tests α50-α55: source files no longer exist (legacy wholesale deletion) ──

  // α50
  it("α50: features/product-types/server.ts no longer exists (legacy barrel deletion — ProductTypesService resolved canonical home @/modules/product-type/presentation/server post-cutover C0-C4)", () => {
    expect(fs.existsSync(PT_SERVER_PATH)).toBe(false);
  });

  // α51
  it("α51: features/product-types/index.ts no longer exists (legacy re-export barrel deletion — schemas zod absorbed canonical home @/modules/product-type/presentation/{server,validation})", () => {
    expect(fs.existsSync(PT_INDEX_PATH)).toBe(false);
  });

  // α52
  it("α52: features/product-types/product-types.types.ts no longer exists (legacy types deletion — ProductType + inputs absorbed domain canonical home)", () => {
    expect(fs.existsSync(PT_TYPES_PATH)).toBe(false);
  });

  // α53
  it("α53: features/product-types/product-types.validation.ts no longer exists (legacy zod schemas deletion — canonical home @/modules/product-type/presentation/validation)", () => {
    expect(fs.existsSync(PT_VALIDATION_PATH)).toBe(false);
  });

  // α54
  it("α54: features/product-types/product-types.service.ts no longer exists (legacy ProductTypesService class deletion — factory hex makeProductTypeService() consumed via composition-root post-cutover C4)", () => {
    expect(fs.existsSync(PT_SERVICE_PATH)).toBe(false);
  });

  // α55
  it("α55: features/product-types/product-types.repository.ts no longer exists (legacy ProductTypesRepository class deletion — canonical home @/modules/product-type/infrastructure/prisma-product-types.repository post-cutover C2)", () => {
    expect(fs.existsSync(PT_REPOSITORY_PATH)).toBe(false);
  });

  // ── Tests α56-α57: PROJECT-scope absence safety net ──

  // α56
  it("α56: zero production source imports `from \"@/features/product-types/server\"` (PROJECT-scope safety net consumer reintroducción)", () => {
    const matches = findFilesMatchingImport(LEGACY_SERVER_IMPORT_RE);
    expect(matches).toEqual([]);
  });

  // α57
  it("α57: zero production source imports `from \"@/features/product-types\"` exact barrel (PROJECT-scope safety net consumer reintroducción)", () => {
    const matches = findFilesMatchingImport(LEGACY_BARREL_IMPORT_RE);
    expect(matches).toEqual([]);
  });
});
