import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePermission } from "@/features/shared/permissions.server";
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

export default async function SettingsHubPage({ params }: SettingsHubPageProps) {
  const { orgSlug } = await params;

  try {
    await requirePermission("accounting-config", "read", orgSlug);
  } catch {
    redirect(`/${orgSlug}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Configuración</h1>
        <p className="text-gray-500 mt-1">
          Catálogo de parámetros y catálogos de la organización
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SETTINGS_CARDS.map(({ id, title, description, href, Icon }) => (
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
