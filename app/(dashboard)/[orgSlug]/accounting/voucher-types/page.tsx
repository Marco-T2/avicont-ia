import { redirect } from "next/navigation";
import { requireAuth, requireOrgAccess } from "@/features/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Settings } from "lucide-react";

interface VoucherTypesPageProps {
  params: Promise<{ orgSlug: string }>;
}

export default async function VoucherTypesPage({ params }: VoucherTypesPageProps) {
  const { orgSlug } = await params;

  let userId: string;
  try {
    const session = await requireAuth();
    userId = session.userId;
  } catch {
    redirect("/sign-in");
  }

  try {
    await requireOrgAccess(userId, orgSlug);
  } catch {
    redirect("/select-org");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Tipos de Comprobante</h1>
        <p className="text-gray-500 mt-1">
          Configuración de tipos de comprobante contable
        </p>
      </div>

      <Card>
        <CardContent className="py-12 text-center">
          <Settings className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600">Próximamente</p>
          <p className="text-sm text-gray-400 mt-1">
            La gestión de tipos de comprobante estará disponible en una próxima versión
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
