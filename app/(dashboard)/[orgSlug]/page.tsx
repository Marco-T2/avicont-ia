import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Users, Brain, ArrowRight, Upload } from "lucide-react";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

interface OrgDashboardPageProps {
  params: Promise<{ orgSlug: string }>; // Add Promise wrapper
}

export default async function OrgDashboardPage({
  params,
}: OrgDashboardPageProps) {
  // Await the params
  const { orgSlug } = await params;
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  // Get organization with stats
  const organization = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    include: {
      _count: {
        select: {
          documents: true,
          members: true,
        },
      },
      documents: {
        take: 5,
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!organization) {
    redirect("/select-org");
  }

  // Check membership
  const membership = await prisma.organizationMember.findFirst({
    where: {
      organizationId: organization.id,
      user: { clerkUserId: userId },
    },
  });

  if (!membership) {
    redirect("/select-org");
  }

  const analyzedDocs = await prisma.document.count({
    where: {
      organizationId: organization.id,
      aiSummary: { not: null },
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Panel de {organization.name}</h1>
        <p className="text-gray-600">Bienvenido a tu espacio de trabajo</p>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Total de Documentos</CardTitle>
            <CardDescription>En esta organización</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {organization._count.documents}
            </div>
            <Link href={`/${orgSlug}/documents`}>
              <Button variant="ghost" size="sm" className="mt-2">
                Ver Documentos
                <ArrowRight className="ml-2 h-3 w-3" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Miembros del Equipo</CardTitle>
            <CardDescription>Miembros de la organización</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {organization._count.members}
            </div>
            <Button variant="ghost" size="sm" className="mt-2">
              Ver Equipo
              <ArrowRight className="ml-2 h-3 w-3" />
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Analizados</CardTitle>
            <CardDescription>Documentos con análisis de IA</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{analyzedDocs}</div>
            <p className="text-sm text-gray-500 mt-1">
              {(
                (analyzedDocs / organization._count.documents) * 100 || 0
              ).toFixed(0)}
              % analizados
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Documents */}
      <Card>
        <CardHeader>
          <CardTitle>Documentos Recientes</CardTitle>
          <CardDescription>Últimas cargas en tu organización</CardDescription>
        </CardHeader>
        <CardContent>
          {organization.documents.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">No hay documentos cargados aún</p>
              <Link href={`/${orgSlug}/documents`}>
                <Button>
                  <Upload className="h-4 w-4 mr-2" />
                  Subir Primer Documento
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {organization.documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="font-medium">{doc.name}</p>
                      <p className="text-sm text-gray-500">
                        Subido el {new Date(doc.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {doc.aiSummary ? (
                    <Brain className="h-5 w-5 text-green-500" />
                  ) : (
                    <Button variant="outline" size="sm">
                      Analizar
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}