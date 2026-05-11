import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../..");
const DISPATCH_DIR = path.join(REPO_ROOT, "features/dispatch");

const SOURCE_FILES = [
  "server.ts", "index.ts", "dispatch.service.ts", "dispatch.repository.ts",
  "dispatch.types.ts", "dispatch.validation.ts", "dispatch.utils.ts",
  "hub.service.ts", "hub.types.ts", "hub.validation.ts",
];

const LEGACY_IMPORT_RE = /from\s*["']@\/features\/dispatch/;
const SCAN_DIRS = ["app", "features", "modules", "components"];

function walkSources(dir: string): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (["node_modules", ".next", ".turbo", "__tests__"].includes(e.name)) continue;
      out.push(...walkSources(full));
    } else if (e.isFile() && /\.(ts|tsx)$/.test(e.name) && !/\.(test|spec)\.tsx?$/.test(e.name)) {
      out.push(full);
    }
  }
  return out;
}

describe("POC dispatch hex C5 — wholesale delete features/dispatch/", () => {
  for (const file of SOURCE_FILES) {
    it(`features/dispatch/${file} no longer exists`, () => {
      expect(fs.existsSync(path.join(DISPATCH_DIR, file))).toBe(false);
    });
  }

  it("zero production source imports from @/features/dispatch", () => {
    const matches: string[] = [];
    for (const subdir of SCAN_DIRS) {
      for (const file of walkSources(path.join(REPO_ROOT, subdir))) {
        if (LEGACY_IMPORT_RE.test(fs.readFileSync(file, "utf8"))) {
          matches.push(path.relative(REPO_ROOT, file));
        }
      }
    }
    expect(matches).toEqual([]);
  });
});
