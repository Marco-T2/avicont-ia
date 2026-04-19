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
 * *.repository.ts or *.service.ts at their root (direct children only,
 * not sub-directories — accounting sub-barrels are separate features).
 */
function getServerFeatures(): Array<{ name: string; indexPath: string }> {
  const features: Array<{ name: string; indexPath: string }> = [];
  const entries = fs.readdirSync(FEATURES_DIR, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const featureDir = path.join(FEATURES_DIR, entry.name);
    const indexPath = path.join(featureDir, "index.ts");

    if (!fs.existsSync(indexPath)) continue;
    if (!hasServerCode(featureDir)) continue;

    features.push({ name: entry.name, indexPath });
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
