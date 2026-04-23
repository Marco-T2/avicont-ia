"use client";

import { useOrganizationList, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Building,
  Plus,
  ArrowRight,
  Loader2,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

export default function SelectOrgPage() {
  const { user } = useUser();
  const { userMemberships, setActive, createOrganization } =
    useOrganizationList({
      userMemberships: {
        infinite: true,
      },
    });

  const router = useRouter();
  const [orgName, setOrgName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshOrganizations = async () => {
    setIsRefreshing(true);
    try {
      if (userMemberships?.revalidate) {
        await userMemberships.revalidate();
      }
      toast.success("Lista de organizaciones actualizada");
    } catch (error) {
      console.error("Failed to refresh organizations:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCreateOrg = async () => {
    if (!orgName.trim()) {
      toast.error("Por favor ingresá un nombre de organización");
      return;
    }

    setIsCreating(true);
    try {
      if (!createOrganization) {
        throw new Error("La creación de organizaciones no está disponible en este momento.");
      }
      const newOrg = await createOrganization({
        name: orgName.trim(),
      });

      if (!newOrg) {
        throw new Error("Error al crear la organización");
      }

      toast.success(`Organización "${orgName}" creada exitosamente`);
      setOrgName("");

      try {
        const response = await fetch("/api/organizations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clerkOrgId: newOrg.id,
            name: orgName.trim(),
            slug:
              newOrg.slug || orgName.trim().toLowerCase().replace(/\s+/g, "-"),
          }),
        });

        if (!response.ok) {
          console.warn(
            "Database sync had issues, but organization was created in Clerk",
          );
        }
      } catch (dbError) {
        console.warn("Database sync failed:", dbError);
      }

      if (setActive) {
        await setActive({
          organization: newOrg.id,
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
      refreshOrganizations();
      router.refresh();
    } catch (error) {
      console.error("Failed to create organization:", error);
      const message = error instanceof Error ? error.message : "Error al crear la organización";
      toast.error(message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleSelectOrg = async (organization: { id: string; slug: string | null }) => {
    try {
      if (setActive) {
        await setActive({
          organization: organization.id,
        });
      }
      router.push(`/${organization.slug}`);
    } catch (error) {
      console.error("Failed to switch organization:", error);
      toast.error("Error al cambiar de organización");
    }
  };

  const hasOrganizations = (userMemberships?.count ?? 0) > 0;

  // Check if user is an admin in any org (can see create option)
  const isAdminInAnyOrg = userMemberships?.data?.some(
    (m) => m.role === "org:admin" || m.role === "org:owner"
  );

  return (
    <div className="container max-w-4xl mx-auto p-6">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold">¡Bienvenido, {user?.firstName}!</h1>
        <p className="text-gray-600">
          {hasOrganizations
            ? "Seleccioná una organización para continuar"
            : "Esperando asignación a una organización"}
        </p>
      </div>

      {/* Create Organization - only for admins/owners */}
      {isAdminInAnyOrg && (
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Crear Nueva Organización
                </CardTitle>
                <CardDescription>
                  Comenzá un nuevo espacio de trabajo para tu equipo
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Nombre de la organización"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  disabled={isCreating}
                  className="flex-1"
                  onKeyDown={(e) => e.key === "Enter" && handleCreateOrg()}
                />
                <Button
                  onClick={handleCreateOrg}
                  disabled={isCreating || !orgName.trim()}
                  className="min-w-[100px]"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creando...
                    </>
                  ) : (
                    "Crear"
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Organizations list */}
      {hasOrganizations ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Tus Organizaciones ({userMemberships?.count || 0})
            </CardTitle>
            <CardDescription>
              Hacé clic en una organización para ingresar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {userMemberships?.data?.map((membership) => (
                <div
                  key={membership.organization.id}
                  className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => handleSelectOrg(membership.organization)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Building className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">
                          {membership.organization.name}
                        </h3>
                        <span className="bg-gray-100 px-2 py-1 rounded text-xs capitalize text-gray-500">
                          {membership.role === "org:admin" ? "Administrador" :
                           membership.role === "org:owner" ? "Propietario" :
                           "Miembro"}
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-gray-400" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-16">
            <div className="text-center">
              <Clock className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">
                Aún no pertenecés a ninguna organización
              </h3>
              <p className="text-gray-500 max-w-md mx-auto mb-6">
                Un administrador debe agregarte como miembro de una organización.
                Contactá al administrador de tu asociación para que te asigne acceso.
              </p>
              <Button
                variant="outline"
                onClick={refreshOrganizations}
                disabled={isRefreshing}
              >
                {isRefreshing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  "Verificar si ya fui asignado"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
