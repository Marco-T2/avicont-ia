import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Home, ArrowRight } from "lucide-react";
import Link from "next/link";
import { requireAuth, requireOrgAccess } from "@/features/shared";
import { FarmsService } from "@/features/farms";
import { prisma } from "@/lib/prisma";
import FarmsPageClient from "./farms-client";

interface FarmsPageProps {
  params: Promise<{ orgSlug: string }>;
}

export default async function FarmsPage({ params }: FarmsPageProps) {
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

  // Get memberId for the current user in this org
  const member = await prisma.organizationMember.findFirst({
    where: {
      organizationId: orgId,
      user: { clerkUserId: userId },
    },
  });

  if (!member) {
    redirect("/select-org");
  }

  const service = new FarmsService();
  const farms = await service.list(orgId);

  return (
    <div className="space-y-8">
      <FarmsPageClient orgSlug={orgSlug} memberId={member.id} farms={farms} />
    </div>
  );
}
