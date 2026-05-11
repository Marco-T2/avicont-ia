import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../..");

const OP_SERVER_PATH = path.join(REPO_ROOT, "features/org-profile/server.ts");
const OP_INDEX_PATH = path.join(REPO_ROOT, "features/org-profile/index.ts");
const OP_TYPES_PATH = path.join(REPO_ROOT, "features/org-profile/org-profile.types.ts");
const OP_VALIDATION_PATH = path.join(REPO_ROOT, "features/org-profile/org-profile.validation.ts");
const OP_SERVICE_PATH = path.join(REPO_ROOT, "features/org-profile/org-profile.service.ts");
const OP_REPOSITORY_PATH = path.join(REPO_ROOT, "features/org-profile/org-profile.repository.ts");

const LEGACY_SERVER_IMPORT_RE = /from\s*["']@\/features\/org-profile\/server["']/;
const LEGACY_BARREL_IMPORT_RE = /from\s*["']@\/features\/org-profile["']/;
const LEGACY_TYPES_IMPORT_RE = /from\s*["']@\/features\/org-profile\/org-profile\.types["']/;
const LEGACY_VALIDATION_IMPORT_RE = /from\s*["']@\/features\/org-profile\/org-profile\.validation["']/;

const PRODUCTION_SCAN_DIRS = ["app", "features", "modules", "components"];

function walkProductionSources(dir: string): string[] {
  const collected: string[] = [];
  if (!fs.existsSync(dir)) return collected;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", ".next", ".turbo", "__tests__"].includes(entry.name)) continue;
      collected.push(...walkProductionSources(full));
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name)) {
      collected.push(full);
    }
  }
  return collected;
}

function findFilesMatchingImport(re: RegExp): string[] {
  const matches: string[] = [];
  for (const subdir of PRODUCTION_SCAN_DIRS) {
    const root = path.join(REPO_ROOT, subdir);
    for (const file of walkProductionSources(root)) {
      if (re.test(fs.readFileSync(file, "utf8"))) {
        matches.push(path.relative(REPO_ROOT, file));
      }
    }
  }
  return matches;
}

describe("POC org-profile hex C5 — atomic delete features/org-profile/ wholesale shape", () => {
  it("α47: features/org-profile/server.ts no longer exists", () => {
    expect(fs.existsSync(OP_SERVER_PATH)).toBe(false);
  });

  it("α48: features/org-profile/index.ts no longer exists", () => {
    expect(fs.existsSync(OP_INDEX_PATH)).toBe(false);
  });

  it("α49: features/org-profile/org-profile.types.ts no longer exists", () => {
    expect(fs.existsSync(OP_TYPES_PATH)).toBe(false);
  });

  it("α50: features/org-profile/org-profile.validation.ts no longer exists", () => {
    expect(fs.existsSync(OP_VALIDATION_PATH)).toBe(false);
  });

  it("α51: features/org-profile/org-profile.service.ts no longer exists", () => {
    expect(fs.existsSync(OP_SERVICE_PATH)).toBe(false);
  });

  it("α52: features/org-profile/org-profile.repository.ts no longer exists", () => {
    expect(fs.existsSync(OP_REPOSITORY_PATH)).toBe(false);
  });

  it("α53: zero production source imports from @/features/org-profile/server", () => {
    expect(findFilesMatchingImport(LEGACY_SERVER_IMPORT_RE)).toEqual([]);
  });

  it("α54: zero production source imports from @/features/org-profile exact barrel", () => {
    expect(findFilesMatchingImport(LEGACY_BARREL_IMPORT_RE)).toEqual([]);
  });

  it("α55: zero production source imports from @/features/org-profile/org-profile.types", () => {
    expect(findFilesMatchingImport(LEGACY_TYPES_IMPORT_RE)).toEqual([]);
  });

  it("α56: zero production source imports from @/features/org-profile/org-profile.validation", () => {
    expect(findFilesMatchingImport(LEGACY_VALIDATION_IMPORT_RE)).toEqual([]);
  });
});
