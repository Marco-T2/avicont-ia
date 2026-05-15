import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAuth } from "@/features/shared";
import {
  makeOrganizationsService,
  requireOrgAccess,
} from "@/modules/organizations/presentation/server";
import { canAccess } from "@/features/permissions/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SETTINGS_CARDS } from "@/lib/settings/settings-cards";

interface SettingsHubPageProps {
  params: Promise<{ orgSlug: string }>;
}

export const metadata: Metadata = {
  title: "Configuración",
};

/**
 * C3 sidebar-reorg-settings-hub: per-card RBAC + entry-gate broadening.
 *
 * Pre-C3 the page hard-gated on `accounting-config:read` — an admin with
 * only `members:read` (custom role) could not enter even though the
 * Miembros card was the one they needed. Now we resolve session+orgId+role
 * directly (matching `farms/page.tsx`), filter cards individually by
 * `canAccess(role, card.resource, "read", orgId)`, and redirect when the
 * resulting set is empty (page unreachable).
 */
export default async function SettingsHubPage({ params }: SettingsHubPageProps) {
  const { orgSlug } = await params;

  let userId: string;
  try {
    const session = await requireAuth();
    userId = session.userId;
  } catch {
    redirect("/sign-in");
  }

  let orgId: string;
  try {
    orgId = await requireOrgAccess(userId, orgSlug);
  } catch {
    redirect("/select-org");
  }

  const orgService = makeOrganizationsService();
  let member: { role: string };
  try {
    member = await orgService.getMemberByClerkUserId(orgId, userId);
  } catch {
    redirect(`/${orgSlug}`);
  }
  // `redirect()` is typed `never` at runtime; the guards above suffice in
  // production. In test contexts where `redirect` is a non-throwing mock,
  // the bindings stay reachable — defensive narrowing isn't required here
  // because the catch arms exit the function via redirect.

  const allowedFlags = await Promise.all(
    SETTINGS_CARDS.map((card) =>
      card.resource
        ? canAccess(member!.role, card.resource, "read", orgId)
        : Promise.resolve(true),
    ),
  );
  const cards = SETTINGS_CARDS.filter((_, i) => allowedFlags[i]);

  if (cards.length === 0) {
    redirect(`/${orgSlug}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Configuración</h1>
        <p className="text-muted-foreground mt-1">
          Catálogo de parámetros y catálogos de la organización
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(({ id, title, description, href, Icon }) => (
          <Link
            key={id}
            href={href(orgSlug)}
            className="block h-full hover:no-underline"
            aria-label={title}
          >
            <Card size="sm" className="h-full transition-colors">
              <CardHeader>
                <div className="flex items-start gap-3">
                  <Icon className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <CardTitle className="text-sm">{title}</CardTitle>
                    <CardDescription className="mt-1">
                      {description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
