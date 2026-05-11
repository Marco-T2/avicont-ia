import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../..");

// ── C5 RED paths document-signature-config (7 source + test files existence transition, dir absorbed) ──

const DSC_SERVER_PATH = path.join(REPO_ROOT, "features/document-signature-config/server.ts");
const DSC_INDEX_PATH = path.join(REPO_ROOT, "features/document-signature-config/index.ts");
const DSC_TYPES_PATH = path.join(REPO_ROOT, "features/document-signature-config/document-signature-config.types.ts");
const DSC_VALIDATION_PATH = path.join(REPO_ROOT, "features/document-signature-config/document-signature-config.validation.ts");
const DSC_SERVICE_PATH = path.join(REPO_ROOT, "features/document-signature-config/document-signature-config.service.ts");
const DSC_REPOSITORY_PATH = path.join(REPO_ROOT, "features/document-signature-config/document-signature-config.repository.ts");

// ── PROJECT-scope absence regex (safety net consumer reintroducción) ──

const LEGACY_SERVER_IMPORT_RE = /from\s*["']@\/features\/document-signature-config\/server["']/;
const LEGACY_BARREL_IMPORT_RE = /from\s*["']@\/features\/document-signature-config["']/;
const LEGACY_TYPES_IMPORT_RE = /from\s*["']@\/features\/document-signature-config\/document-signature-config\.types["']/;

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

describe("POC document-signature-config hex C5 — atomic delete features/document-signature-config/ wholesale shape (paired sister product-type C5 EXACT mirror)", () => {
  // ── Tests α46-α51: source files no longer exist (legacy wholesale deletion) ──

  // α46
  it("α46: features/document-signature-config/server.ts no longer exists (legacy barrel deletion)", () => {
    expect(fs.existsSync(DSC_SERVER_PATH)).toBe(false);
  });

  // α47
  it("α47: features/document-signature-config/index.ts no longer exists (legacy re-export barrel deletion)", () => {
    expect(fs.existsSync(DSC_INDEX_PATH)).toBe(false);
  });

  // α48
  it("α48: features/document-signature-config/document-signature-config.types.ts no longer exists (legacy types deletion)", () => {
    expect(fs.existsSync(DSC_TYPES_PATH)).toBe(false);
  });

  // α49
  it("α49: features/document-signature-config/document-signature-config.validation.ts no longer exists (legacy zod schemas deletion)", () => {
    expect(fs.existsSync(DSC_VALIDATION_PATH)).toBe(false);
  });

  // α50
  it("α50: features/document-signature-config/document-signature-config.service.ts no longer exists (legacy service class deletion)", () => {
    expect(fs.existsSync(DSC_SERVICE_PATH)).toBe(false);
  });

  // α51
  it("α51: features/document-signature-config/document-signature-config.repository.ts no longer exists (legacy repository class deletion)", () => {
    expect(fs.existsSync(DSC_REPOSITORY_PATH)).toBe(false);
  });

  // ── Tests α52-α54: PROJECT-scope absence safety net ──

  // α52
  it("α52: zero production source imports `from \"@/features/document-signature-config/server\"` (PROJECT-scope safety net)", () => {
    const matches = findFilesMatchingImport(LEGACY_SERVER_IMPORT_RE);
    expect(matches).toEqual([]);
  });

  // α53
  it("α53: zero production source imports `from \"@/features/document-signature-config\"` exact barrel (PROJECT-scope safety net)", () => {
    const matches = findFilesMatchingImport(LEGACY_BARREL_IMPORT_RE);
    expect(matches).toEqual([]);
  });

  // α54
  it("α54: zero production source imports `from \"@/features/document-signature-config/document-signature-config.types\"` (PROJECT-scope safety net)", () => {
    const matches = findFilesMatchingImport(LEGACY_TYPES_IMPORT_RE);
    expect(matches).toEqual([]);
  });
});
