/**
 * Feature Module Boundaries — Invariant Test
 *
 * REQ-FMB.3 / REQ-FMB.6: Every `features/<name>/index.ts` for a feature that
 * has server code MUST NOT re-export any symbol whose name ends in `Repository`
 * or `Service`.
 *
 * How it works:
 *  1. Scan `features/` for directories that contain at least one *.repository.ts
 *     or *.service.ts (these are "server features").
 *  2. For each server feature, read its index.ts and parse the export identifiers.
 *  3. Assert that zero exported identifiers match /(Repository|Service)$/.
 *
 * This test starts RED for all unsplit barrels and turns GREEN feature-by-feature
 * as each batch (T1–T26) is applied.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const FEATURES_DIR = path.resolve(__dirname, "../features");

/** Returns true if the directory contains at least one *.repository.ts or *.service.ts */
function hasServerCode(featureDir: string): boolean {
  try {
    const entries = fs.readdirSync(featureDir, { withFileTypes: true });
    return entries.some(
      (e) =>
        e.isFile() &&
        (e.name.endsWith(".repository.ts") || e.name.endsWith(".service.ts")),
    );
  } catch {
    return false;
  }
}

/**
 * Parse exported identifiers from an index.ts file.
 * Handles:
 *   - `export { Foo, Bar } from "..."`
 *   - `export { Foo as FooAlias } from "..."`
 *   - `export * from "./some.repository"` (wildcard — checked by target filename)
 *   - `export class Foo`
 *   - `export function foo`
 *   - `export const foo`
 * Returns the set of exported names AND wildcard violation paths.
 */
interface ParseResult {
  identifiers: string[];
  /** Wildcard re-exports (export * from "...") whose target path looks like a repository or service */
  wildcardViolations: string[];
}

function parseExports(indexPath: string, featureDir: string): ParseResult {
  const source = fs.readFileSync(indexPath, "utf8");
  const identifiers: string[] = [];
  const wildcardViolations: string[] = [];

  // Match named export braces: export { Foo, Bar as Baz } from "..."
  const namedExportRe = /export\s*\{([^}]+)\}/g;
  let match: RegExpExecArray | null;
  while ((match = namedExportRe.exec(source)) !== null) {
    const clause = match[1];
    for (const part of clause.split(",")) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      // If there's "as", the exported name is the alias
      const asMatch = /\bas\s+(\w+)/.exec(trimmed);
      if (asMatch) {
        identifiers.push(asMatch[1]);
      } else {
        const name = trimmed.replace(/^type\s+/, "").trim();
        if (name) identifiers.push(name);
      }
    }
  }

  // Match: export class Foo / export function foo / export const foo / export abstract class Foo
  const declarationRe =
    /^export\s+(?:default\s+)?(?:abstract\s+)?(?:class|function|const|let|var|enum|type|interface)\s+(\w+)/gm;
  while ((match = declarationRe.exec(source)) !== null) {
    identifiers.push(match[1]);
  }

  // Match wildcard re-exports: export * from "./something"
  // If the resolved file is a *.repository.ts or *.service.ts, it's a violation.
  const wildcardRe = /^export\s+\*\s+from\s+["']([^"']+)["']/gm;
  while ((match = wildcardRe.exec(source)) !== null) {
    const specifier = match[1];
    // Resolve relative to the feature dir
    let resolved = path.resolve(featureDir, specifier);
    // Try as-is, then with .ts extension
    if (!fs.existsSync(resolved)) {
      resolved = resolved + ".ts";
    }
    if (
      resolved.endsWith(".repository.ts") ||
      resolved.endsWith(".service.ts")
    ) {
      wildcardViolations.push(specifier);
    }
  }

  return { identifiers, wildcardViolations };
}

/**
 * Collect all "server features": features that have at least one
 * *.repository.ts or *.service.ts at their root (direct children only).
 * Also recurses one level into accounting sub-barrels
 * (iva-books, financial-statements) which each have their own index.ts.
 */
function getServerFeatures(): Array<{ name: string; indexPath: string }> {
  const features: Array<{ name: string; indexPath: string }> = [];
  const entries = fs.readdirSync(FEATURES_DIR, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const featureDir = path.join(FEATURES_DIR, entry.name);
    const indexPath = path.join(featureDir, "index.ts");

    if (fs.existsSync(indexPath) && hasServerCode(featureDir)) {
      features.push({ name: entry.name, indexPath });
    }

    // Always recurse one level — a parent without its own index.ts
    // (e.g. accounting/) can still contain sub-features that must be guarded.
    const subEntries = fs.readdirSync(featureDir, { withFileTypes: true });
    for (const sub of subEntries) {
      if (!sub.isDirectory()) continue;
      const subDir = path.join(featureDir, sub.name);
      const subIndex = path.join(subDir, "index.ts");
      if (!fs.existsSync(subIndex)) continue;
      if (!hasServerCode(subDir)) continue;
      features.push({ name: `${entry.name}/${sub.name}`, indexPath: subIndex });
    }
  }

  return features;
}

describe("Feature Module Boundaries (REQ-FMB.3)", () => {
  const serverFeatures = getServerFeatures();

  it("should detect at least one server feature to guard", () => {
    expect(serverFeatures.length).toBeGreaterThan(0);
  });

  for (const { name, indexPath } of serverFeatures) {
    const featureDir = path.join(FEATURES_DIR, name);

    it(`features/${name}/index.ts must not export any Repository or Service`, () => {
      const { identifiers, wildcardViolations } = parseExports(
        indexPath,
        featureDir,
      );

      const namedViolations = identifiers.filter((id) =>
        /(Repository|Service)$/.test(id),
      );

      const allViolations = [
        ...namedViolations,
        ...wildcardViolations.map((p) => `export * from "${p}"`),
      ];

      expect(
        allViolations,
        `features/${name}/index.ts exports server symbols: ${allViolations.join(", ")}. ` +
          `Move them to features/${name}/server.ts`,
      ).toHaveLength(0);
    });
  }
});

/**
 * REQ-FMB.4: No cross-feature deep imports from production code.
 *
 * When code under `features/<X>/` (excluding tests) imports from another feature
 * via `@/features/<Y>/...`, the import path MUST resolve to a public barrel:
 *   - bare top-level: `@/features/<Y>` or `@/features/<Y>/<subfeature>`
 *   - server barrel:  `@/features/<Y>/server` (or sub-feature's server)
 *   - client barrel:  `@/features/<Y>/index` (or sub-feature's index)
 *   - cache barrel:   `@/features/<Y>/cache` (optional second server-only barrel
 *     exposing state-cache primitives without loading gates/services that the
 *     cache's own consumers might create circular imports through)
 *
 * Exemptions:
 *   - same-feature imports (X → X) — trivially allowed
 *   - `features/shared/*` as TARGET — shared is flat infrastructure without a
 *     `server.ts` barrel; every other feature treats its leaf files as the API
 *   - test files (`*.test.ts`, `*.test.tsx`) and anything under `__tests__/`
 *
 * Note: `features/shared/*` as SOURCE is NOT exempted — shared must not depend
 * on domain features (inverted dependency).
 */

/** Collect every directory under features/ that exposes a barrel (server.ts or index.ts). */
function collectValidBarrelPaths(): Set<string> {
  const valid = new Set<string>();
  const walk = (dir: string, rel: string, depth: number) => {
    if (depth > 2) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    const hasBarrel = entries.some(
      (e) => e.isFile() && (e.name === "server.ts" || e.name === "index.ts"),
    );
    if (hasBarrel && rel) valid.add(rel);
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (e.name === "__tests__") continue;
      const subRel = rel ? `${rel}/${e.name}` : e.name;
      walk(path.join(dir, e.name), subRel, depth + 1);
    }
  };
  walk(FEATURES_DIR, "", 0);
  return valid;
}

/** Top-level feature name from a file path relative to FEATURES_DIR. */
function topLevelFeature(relPath: string): string {
  return relPath.split(path.sep)[0];
}

interface DeepImportViolation {
  file: string;
  line: number;
  target: string;
}

/**
 * Walk every production *.ts / *.tsx file under features/ and collect imports
 * of `@/features/<target>` that violate the barrel contract (see REQ-FMB.4).
 */
function collectCrossFeatureDeepImports(
  validBarrelPaths: Set<string>,
): DeepImportViolation[] {
  const violations: DeepImportViolation[] = [];
  const IMPORT_RE = /from\s+["']@\/features\/([^"']+)["']/g;

  const walk = (dir: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === "__tests__") continue;
        walk(full);
        continue;
      }
      if (!e.isFile()) continue;
      if (!(e.name.endsWith(".ts") || e.name.endsWith(".tsx"))) continue;
      if (e.name.endsWith(".test.ts") || e.name.endsWith(".test.tsx")) continue;

      const rel = path.relative(FEATURES_DIR, full);
      const sourceFeature = topLevelFeature(rel);
      let source: string;
      try {
        source = fs.readFileSync(full, "utf8");
      } catch {
        continue;
      }

      const lines = source.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        IMPORT_RE.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = IMPORT_RE.exec(line)) !== null) {
          const target = match[1];
          const targetTop = target.split("/")[0];
          if (targetTop === sourceFeature) continue; // same-feature
          if (targetTop === "shared") continue; // exempted target

          // Allowed forms: bare feature path, path/server, path/index, path/cache
          let allowed = false;
          for (const vp of validBarrelPaths) {
            if (
              target === vp ||
              target === `${vp}/server` ||
              target === `${vp}/index` ||
              target === `${vp}/cache`
            ) {
              allowed = true;
              break;
            }
          }
          if (!allowed) {
            violations.push({
              file: `features/${rel.split(path.sep).join("/")}`,
              line: i + 1,
              target,
            });
          }
        }
      }
    }
  };

  walk(FEATURES_DIR);
  return violations;
}

describe("Feature Module Boundaries (REQ-FMB.4) — no cross-feature deep imports", () => {
  const validBarrelPaths = collectValidBarrelPaths();
  const violations = collectCrossFeatureDeepImports(validBarrelPaths);

  it("should detect at least one valid barrel path", () => {
    expect(validBarrelPaths.size).toBeGreaterThan(0);
  });

  it("production code must not deep-import into other features' internals", () => {
    const message = violations
      .map((v) => `  ${v.file}:${v.line} → @/features/${v.target}`)
      .join("\n");
    expect(
      violations,
      `\n${violations.length} cross-feature deep-import violations found:\n${message}\n\n` +
        `Fix: extend the target feature's server.ts barrel and import from there.\n` +
        `Target exemption: features/shared/* (flat infrastructure).\n` +
        `Source exemption: none — shared must not depend on domain features.`,
    ).toHaveLength(0);
  });
});

/**
 * REQ-FMB.5: No deep imports from app/ routes into feature internals.
 *
 * Next.js routes under `app/` (API handlers, page.tsx, server components, client
 * components that live alongside routes) must consume features via the public
 * barrel — `@/features/<X>`, `@/features/<X>/server`, or `@/features/<X>/index`.
 *
 * Exemptions:
 *   - `features/shared/*` (flat infrastructure, as in REQ-FMB.4)
 *   - test files (*.test.ts, *.test.tsx, __tests__/)
 */

interface AppDeepImportViolation {
  file: string;
  line: number;
  target: string;
  key: string;
}

function collectAppDeepImports(
  validBarrelPaths: Set<string>,
): AppDeepImportViolation[] {
  const violations: AppDeepImportViolation[] = [];
  const IMPORT_RE = /from\s+["']@\/features\/([^"']+)["']/g;
  const APP_DIR = path.resolve(__dirname, "../app");

  const walk = (dir: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === "__tests__") continue;
        walk(full);
        continue;
      }
      if (!e.isFile()) continue;
      if (!(e.name.endsWith(".ts") || e.name.endsWith(".tsx"))) continue;
      if (e.name.endsWith(".test.ts") || e.name.endsWith(".test.tsx")) continue;

      let source: string;
      try {
        source = fs.readFileSync(full, "utf8");
      } catch {
        continue;
      }

      const rel = path.relative(path.resolve(__dirname, ".."), full);
      const lines = source.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        IMPORT_RE.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = IMPORT_RE.exec(line)) !== null) {
          const target = match[1];
          const targetTop = target.split("/")[0];
          if (targetTop === "shared") continue;

          let allowed = false;
          for (const vp of validBarrelPaths) {
            if (
              target === vp ||
              target === `${vp}/server` ||
              target === `${vp}/index`
            ) {
              allowed = true;
              break;
            }
          }
          if (!allowed) {
            const normFile = rel.split(path.sep).join("/");
            violations.push({
              file: normFile,
              line: i + 1,
              target,
              key: `${normFile}::${target}`,
            });
          }
        }
      }
    }
  };

  walk(APP_DIR);
  return violations;
}

describe("Feature Module Boundaries (REQ-FMB.5) — no deep imports from app/", () => {
  const validBarrelPaths = collectValidBarrelPaths();
  const violations = collectAppDeepImports(validBarrelPaths);

  it("app/ code must not deep-import into features' internals", () => {
    const message = violations
      .map((v) => `  ${v.file}:${v.line} → @/features/${v.target}`)
      .join("\n");
    expect(
      violations,
      `\n${violations.length} app/ deep-import violations found:\n${message}\n\n` +
        `Fix: route through the target feature's server.ts or index.ts barrel, ` +
        `or use the bare top-level path @/features/<name>.`,
    ).toHaveLength(0);
  });
});
