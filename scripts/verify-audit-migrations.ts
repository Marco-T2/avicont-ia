/**
 * Verifica T29 (índices) y T30 (data migration permisos) end-to-end.
 *
 * T29 — Índices en audit_logs.
 * T30 — REQ-AUDIT.7 scenarios:
 *   - A7-S1: migration añade "audit" a orgs sin él (fixture sintético + UPDATE).
 *   - A7-S2: re-run es no-op.
 *   - A7-S3: orgs nuevas reciben "audit" vía seed dinámico.
 *   - A7-S4: roles no owner/admin no fueron tocados.
 *
 * Crea una org+2 roles sintéticos para A7-S1 y A7-S2; cleanup en finally.
 */
import { prisma } from "@/lib/prisma";
import { buildSystemRolePayloads } from "@/prisma/seed-system-roles";

const FIXTURE_PREFIX = "verify-audit-migrations";

async function main() {
  let exitCode = 0;
  const stamp = Date.now();
  const fixtureOrgId = `org-${FIXTURE_PREFIX}-${stamp}`;

  // ── T29 ───────────────────────────────────────────────────────────────────
  console.log("\n═══ T29 — Índices en audit_logs ═══\n");

  const indexes = await prisma.$queryRaw<{ indexname: string }[]>`
    SELECT indexname FROM pg_indexes WHERE tablename = 'audit_logs' ORDER BY indexname;
  `;
  const expected = [
    "audit_logs_correlationId_idx",
    "audit_logs_organizationId_changedById_createdAt_idx",
    "audit_logs_organizationId_createdAt_idx",
    "audit_logs_organizationId_entityType_createdAt_idx",
    "audit_logs_organizationId_entityType_entityId_idx",
    "audit_logs_pkey",
  ];
  const found = indexes.map((i) => i.indexname).sort();
  console.log("Índices:", found);
  const missing = expected.filter((e) => !found.includes(e));
  if (missing.length === 0) {
    console.log("✅ T29 PASS — 6 índices presentes (3 previos + 2 nuevos + pkey).");
  } else {
    console.log("❌ T29 FAIL — faltan:", missing);
    exitCode = 1;
  }

  // ── T30 A7-S3: seed dinámico ──────────────────────────────────────────────
  console.log("\n═══ T30 A7-S3 — buildSystemRolePayloads incluye 'audit' ═══\n");

  const payloads = buildSystemRolePayloads("fake-org-for-payload-check");
  const ownerPayload = payloads.find((p) => p.slug === "owner");
  const adminPayload = payloads.find((p) => p.slug === "admin");
  const facturadorPayload = payloads.find((p) => p.slug === "contador");

  console.log(`owner.permissionsRead incluye 'audit': ${ownerPayload?.permissionsRead.includes("audit")}`);
  console.log(`admin.permissionsRead incluye 'audit': ${adminPayload?.permissionsRead.includes("audit")}`);
  console.log(`contador.permissionsRead incluye 'audit': ${facturadorPayload?.permissionsRead.includes("audit")}`);

  if (
    ownerPayload?.permissionsRead.includes("audit") &&
    adminPayload?.permissionsRead.includes("audit") &&
    !facturadorPayload?.permissionsRead.includes("audit")
  ) {
    console.log("✅ A7-S3 PASS — owner/admin nuevos reciben 'audit'; otros roles no.");
  } else {
    console.log("❌ A7-S3 FAIL — el seed dinámico no produce el shape esperado.");
    exitCode = 1;
  }

  // ── T30 A7-S2: idempotencia con 0 rows ────────────────────────────────────
  console.log("\n═══ T30 A7-S2 — UPDATE idempotente con 0 system roles ═══\n");

  const noopResult = await prisma.$executeRaw`
    UPDATE "custom_roles"
    SET "permissionsRead" = array_append("permissionsRead", 'audit')
    WHERE "slug" IN ('owner', 'admin')
      AND "isSystem" = true
      AND NOT ('audit' = ANY("permissionsRead"));
  `;
  console.log(`Rows actualizadas (esperado 0 si todo está bien): ${noopResult}`);
  if (noopResult === 0) {
    console.log("✅ A7-S2 PASS — re-run es no-op cuando no hay rows que actualizar.");
  } else {
    console.log(`⚠️  A7-S2 — se actualizaron ${noopResult} rows. Significa que algún owner/admin no tenía 'audit' antes (state drift entre reset y check).`);
  }

  // ── T30 A7-S1: fixture sintético sin 'audit' + UPDATE ─────────────────────
  console.log("\n═══ T30 A7-S1 — migration añade 'audit' a roles existentes sin él ═══\n");

  try {
    // 1. Crear org fixture
    await prisma.organization.create({
      data: {
        id: fixtureOrgId,
        clerkOrgId: `clerk-${fixtureOrgId}`,
        name: "Fixture Verify Audit",
        slug: fixtureOrgId,
      },
    });

    // 2. Crear 2 system roles (owner + admin) SIN 'audit' en permissionsRead
    //    Simula el estado pre-migration de orgs viejas.
    await prisma.customRole.createMany({
      data: [
        {
          organizationId: fixtureOrgId,
          slug: "owner",
          name: "Owner",
          isSystem: true,
          permissionsRead: ["sales", "purchases", "members"], // sin 'audit'
          permissionsWrite: ["sales"],
          canPost: ["sales"],
        },
        {
          organizationId: fixtureOrgId,
          slug: "admin",
          name: "Admin",
          isSystem: true,
          permissionsRead: ["sales", "members"], // sin 'audit'
          permissionsWrite: ["sales"],
          canPost: [],
        },
        {
          organizationId: fixtureOrgId,
          slug: "facturador",
          name: "Facturador",
          isSystem: true,
          permissionsRead: ["sales"], // sin 'audit', NO debería ser tocado por la migration
          permissionsWrite: [],
          canPost: [],
        },
      ],
    });

    // 3. Estado pre-UPDATE
    const before = await prisma.customRole.findMany({
      where: { organizationId: fixtureOrgId },
      select: { slug: true, permissionsRead: true },
      orderBy: { slug: "asc" },
    });
    console.log("Antes del UPDATE:");
    for (const r of before) {
      console.log(`  ${r.slug}: [${r.permissionsRead.join(", ")}]`);
    }

    // 4. Correr el UPDATE de la migration
    const updated = await prisma.$executeRaw`
      UPDATE "custom_roles"
      SET "permissionsRead" = array_append("permissionsRead", 'audit')
      WHERE "slug" IN ('owner', 'admin')
        AND "isSystem" = true
        AND NOT ('audit' = ANY("permissionsRead"));
    `;
    console.log(`\nRows actualizadas: ${updated} (esperado: 2 — owner + admin del fixture)`);

    // 5. Verificar estado post-UPDATE
    const after = await prisma.customRole.findMany({
      where: { organizationId: fixtureOrgId },
      select: { slug: true, permissionsRead: true },
      orderBy: { slug: "asc" },
    });
    console.log("\nDespués del UPDATE:");
    for (const r of after) {
      console.log(`  ${r.slug}: [${r.permissionsRead.join(", ")}]`);
    }

    const ownerHasAudit = after.find((r) => r.slug === "owner")?.permissionsRead.includes("audit");
    const adminHasAudit = after.find((r) => r.slug === "admin")?.permissionsRead.includes("audit");
    const facturadorHasAudit = after.find((r) => r.slug === "facturador")?.permissionsRead.includes("audit");

    if (ownerHasAudit && adminHasAudit && !facturadorHasAudit && updated === 2) {
      console.log("\n✅ A7-S1 PASS — owner+admin recibieron 'audit', facturador NO tocado, UPDATE 2.");
    } else {
      console.log(`\n❌ A7-S1 FAIL — owner=${ownerHasAudit} admin=${adminHasAudit} facturador=${facturadorHasAudit} updated=${updated}`);
      exitCode = 1;
    }

    // 6. Re-correr UPDATE — debe ser no-op (A7-S2 con fixture)
    const rerun = await prisma.$executeRaw`
      UPDATE "custom_roles"
      SET "permissionsRead" = array_append("permissionsRead", 'audit')
      WHERE "slug" IN ('owner', 'admin')
        AND "isSystem" = true
        AND NOT ('audit' = ANY("permissionsRead"));
    `;
    console.log(`\nRe-run UPDATE: ${rerun} rows (esperado: 0 — guard NOT ANY filtra todo).`);
    if (rerun === 0) {
      console.log("✅ A7-S2 PASS (con fixture) — idempotencia confirmada.");
    } else {
      console.log(`❌ A7-S2 FAIL — re-run actualizó ${rerun} rows, debería ser 0.`);
      exitCode = 1;
    }
  } finally {
    // CLEANUP — siempre, aunque haya falla.
    await prisma.customRole.deleteMany({
      where: { organizationId: fixtureOrgId },
    });
    await prisma.organization.deleteMany({
      where: { id: fixtureOrgId },
    });
    console.log("\n🧹 Cleanup fixture completado.");
  }

  process.exit(exitCode);
}

main().catch((err) => {
  console.error("ERROR:", err);
  process.exit(2);
});
