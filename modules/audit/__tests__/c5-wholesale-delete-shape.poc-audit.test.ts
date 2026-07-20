import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../..");

// α40–α46 (per-file `!existsSync(features/audit/*)`) were REMOVED: they are
// subsumed by α1 in __tests__/feature-boundaries.test.ts, which asserts the
// whole `features/` directory does not exist. A directory that cannot exist
// cannot host these seven files. The import scanners below are NOT subsumed by
// α1 and stay.

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
  it("α47: zero production source imports from @/features/audit/server", () => {
    expect(findFilesMatchingImport(LEGACY_SERVER_IMPORT_RE)).toEqual([]);
  });
  it("α48: zero production source imports from @/features/audit barrel", () => {
    expect(findFilesMatchingImport(LEGACY_BARREL_IMPORT_RE)).toEqual([]);
  });
});
