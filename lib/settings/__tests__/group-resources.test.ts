/**
 * PR2.1 [RED] — Tests for groupResources() pure function
 * REQ-RM.1, REQ-RM.2, REQ-RM.3, REQ-RM.4
 */
import { describe, it, expect } from "vitest";
import type { Resource } from "@/features/permissions";
import type { Module } from "@/components/sidebar/modules/registry";
import { groupResources } from "@/lib/settings/group-resources";

// Minimal Module stub for testing (doesn't need icon/navItems/homeRoute)
function makeModule(id: string, label: string, resources: Resource[]): Module {
  return {
    id: id as Module["id"],
    label,
    icon: null,
    resources,
    homeRoute: () => "/",
    navItems: [],
  };
}

const ALL_RESOURCES: Resource[] = [
  "members",
  "accounting-config",
  "sales",
  "purchases",
  "payments",
  "journal",
  "dispatches",
  "reports",
  "contacts",
  "farms",
  "documents",
  "agent",
];

const MODULES_STUB: Module[] = [
  makeModule("contabilidad", "Contabilidad", [
    "journal",
    "sales",
    "purchases",
    "payments",
    "dispatches",
    "reports",
    "contacts",
    "accounting-config",
  ]),
  makeModule("granjas", "Granjas", ["farms"]),
];

describe("groupResources()", () => {
  it("(a) returns one MatrixGroup per module + Organización last", () => {
    const groups = groupResources(ALL_RESOURCES, MODULES_STUB);
    // 2 modules + 1 Organización = 3 groups
    expect(groups).toHaveLength(3);
    expect(groups[0].label).toBe("Contabilidad");
    expect(groups[1].label).toBe("Granjas");
    expect(groups[2].label).toBe("Organización");
  });

  it("(b) resources not in any module land in Organización", () => {
    const groups = groupResources(ALL_RESOURCES, MODULES_STUB);
    const orgGroup = groups.find((g) => g.label === "Organización");
    expect(orgGroup).toBeDefined();
    // agent, members, documents are not in any module
    expect(orgGroup!.resources).toContain("agent");
    expect(orgGroup!.resources).toContain("members");
    expect(orgGroup!.resources).toContain("documents");
    // farms IS in granjas — must NOT appear in Organización
    expect(orgGroup!.resources).not.toContain("farms");
  });

  it("(c) section order mirrors MODULES[] order", () => {
    const reversedModules = [...MODULES_STUB].reverse(); // granjas first
    const groups = groupResources(ALL_RESOURCES, reversedModules);
    expect(groups[0].label).toBe("Granjas");
    expect(groups[1].label).toBe("Contabilidad");
    expect(groups[groups.length - 1].label).toBe("Organización");
  });

  it("(d) empty module group is dropped", () => {
    // A module that claims a resource not in allResources → zero rows in its section
    const withEmptyModule: Module[] = [
      ...MODULES_STUB,
      makeModule("rrhh", "RRHH", [
        // "staff" is not in ALL_RESOURCES — this module will produce no rows
      ] as Resource[]),
    ];
    const groups = groupResources(ALL_RESOURCES, withEmptyModule);
    expect(groups.find((g) => g.label === "RRHH")).toBeUndefined();
  });

  it("(e) new module with 1 resource appears automatically as a section", () => {
    // Simulate adding a new module that claims "agent"
    const withNewModule: Module[] = [
      ...MODULES_STUB,
      makeModule("organización-module", "IA Tools", ["agent"] as Resource[]),
    ];
    const groups = groupResources(ALL_RESOURCES, withNewModule);
    const iaGroup = groups.find((g) => g.label === "IA Tools");
    expect(iaGroup).toBeDefined();
    expect(iaGroup!.resources).toContain("agent");
    // "agent" should no longer be in Organización since it's claimed by a module
    const orgGroup = groups.find((g) => g.label === "Organización");
    // org group may be absent or not contain agent
    if (orgGroup) {
      expect(orgGroup.resources).not.toContain("agent");
    }
  });
});
