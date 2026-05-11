import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../..");

const AUDIT_DIR = path.join(REPO_ROOT, "features/audit");
const AUDIT_SERVER = path.join(AUDIT_DIR, "server.ts");
const AUDIT_INDEX = path.join(AUDIT_DIR, "index.ts");
const AUDIT_SERVICE = path.join(AUDIT_DIR, "audit.service.ts");
const AUDIT_REPO = path.join(AUDIT_DIR, "audit.repository.ts");
const AUDIT_TYPES = path.join(AUDIT_DIR, "audit.types.ts");
const AUDIT_CLASSIFIER = path.join(AUDIT_DIR, "audit.classifier.ts");
const AUDIT_VALIDATION = path.join(AUDIT_DIR, "audit.validation.ts");

const LEGACY_SERVER_IMPORT_RE = /from\s*["']@\/features\/audit\/server["']/;
const LEGACY_BARREL_IMPORT_RE = /from\s*["']@\/features\/audit["']/;

const PRODUCTION_SCAN_DIRS = ["app", "features", "modules", "components"];

function walkProductionSources(dir: string): string[] {
  const collected: string[] = [];
  if (!fs.existsSync(dir)) return collected;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
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

describe("POC audit hex C5 — atomic delete features/audit/ wholesale shape", () => {
  it("α40: features/audit/server.ts no longer exists", () => { expect(fs.existsSync(AUDIT_SERVER)).toBe(false); });
  it("α41: features/audit/index.ts no longer exists", () => { expect(fs.existsSync(AUDIT_INDEX)).toBe(false); });
  it("α42: features/audit/audit.service.ts no longer exists", () => { expect(fs.existsSync(AUDIT_SERVICE)).toBe(false); });
  it("α43: features/audit/audit.repository.ts no longer exists", () => { expect(fs.existsSync(AUDIT_REPO)).toBe(false); });
  it("α44: features/audit/audit.types.ts no longer exists", () => { expect(fs.existsSync(AUDIT_TYPES)).toBe(false); });
  it("α45: features/audit/audit.classifier.ts no longer exists", () => { expect(fs.existsSync(AUDIT_CLASSIFIER)).toBe(false); });
  it("α46: features/audit/audit.validation.ts no longer exists", () => { expect(fs.existsSync(AUDIT_VALIDATION)).toBe(false); });

  it("α47: zero production source imports from @/features/audit/server", () => {
    expect(findFilesMatchingImport(LEGACY_SERVER_IMPORT_RE)).toEqual([]);
  });
  it("α48: zero production source imports from @/features/audit barrel", () => {
    expect(findFilesMatchingImport(LEGACY_BARREL_IMPORT_RE)).toEqual([]);
  });
});
