/**
 * T14 RED — feature-boundaries: invariante estático de tenant isolation +
 * split-native client/server barrels.
 *
 * Expected failure (RED justificado):
 *   - "no $queryRaw fuera de scopedQueryRaw" PASA trivialmente (no existen
 *     archivos del feature que contengan el patrón prohibido — no hay
 *     production code todavía).
 *   - "listFlat y getVoucherHistory llaman this.scopedQueryRaw" FALLA porque
 *     audit.repository.ts aún no existe (se crea en T10). readFileSync
 *     lanzará ENOENT hasta T10.
 *   - "index.ts no re-exporta Repository/Service" FALLA porque index.ts aún
 *     no existe (se crea en T15). readFileSync lanzará ENOENT hasta T15.
 *
 * Al terminar T10 y T15 este archivo debe pasar GREEN (T28 lo verifica).
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const FEATURE_DIR = path.resolve(__dirname, "..");

function listFeatureFiles(): string[] {
  const results: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "__tests__") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith(".ts")) results.push(full);
    }
  };
  walk(FEATURE_DIR);
  return results;
}

describe("features/audit — tenant isolation invariant (REQ-AUDIT.5)", () => {
  it("no $queryRaw/$queryRawUnsafe/$executeRaw fuera de AuditRepository.scopedQueryRaw", () => {
    const violations: Array<{ file: string; line: number; snippet: string }> = [];
    const FORBIDDEN = /\$queryRaw|\$queryRawUnsafe|\$executeRaw|\$executeRawUnsafe/;

    for (const file of listFeatureFiles()) {
      const source = fs.readFileSync(file, "utf8");
      const lines = source.split("\n");
      const isRepoFile = file.endsWith("audit.repository.ts");

      lines.forEach((line, idx) => {
        if (!FORBIDDEN.test(line)) return;
        if (isRepoFile) {
          // Permitido: el único sitio donde puede aparecer $queryRaw es dentro
          // de scopedQueryRaw. Validamos que el método existe en el archivo.
          if (!source.includes("protected async scopedQueryRaw")) {
            violations.push({ file, line: idx + 1, snippet: line.trim() });
          }
          return;
        }
        violations.push({ file, line: idx + 1, snippet: line.trim() });
      });
    }

    expect(
      violations,
      `\nAudit module violates tenant isolation:\n${violations
        .map(
          (v) =>
            `  ${path.relative(FEATURE_DIR, v.file)}:${v.line} — ${v.snippet}`,
        )
        .join("\n")}`,
    ).toHaveLength(0);
  });

  it("AuditRepository.listFlat y getVoucherHistory llaman this.scopedQueryRaw", () => {
    const repoPath = path.join(FEATURE_DIR, "audit.repository.ts");
    const source = fs.readFileSync(repoPath, "utf8");
    expect(source).toMatch(/async\s+listFlat[\s\S]*?this\.scopedQueryRaw/);
    expect(source).toMatch(/async\s+getVoucherHistory[\s\S]*?this\.scopedQueryRaw/);
  });
});

describe("features/audit — split-native barrels (REQ-AUDIT.10 / A10-S3)", () => {
  it("index.ts no re-exporta símbolos terminados en Repository o Service", () => {
    const indexPath = path.join(FEATURE_DIR, "index.ts");
    const source = fs.readFileSync(indexPath, "utf8");
    const offenders = Array.from(
      source.matchAll(/\b(\w+(?:Repository|Service))\b/g),
      (m) => m[1],
    );
    expect(
      offenders,
      `\nindex.ts re-exporta server-only symbols:\n  ${offenders.join(", ")}`,
    ).toHaveLength(0);
  });
});
