"use client";

import { useRouter } from "next/navigation";
import { Users } from "lucide-react";
import AddMemberDialog from "./add-member-dialog";
import MembersTable from "./members-table";

interface Member {
  id: string;
  role: string;
  userId: string;
  name: string;
  email: string;
}

interface MembersPageClientProps {
  orgSlug: string;
  members: Member[];
}

export default function MembersPageClient({
  orgSlug,
  members,
}: MembersPageClientProps) {
  const router = useRouter();

  const handleRefresh = () => {
    router.refresh();
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold">Miembros</h1>
            <p className="text-muted-foreground">
              Administra los miembros de tu organización
            </p>
          </div>
        </div>
        <AddMemberDialog orgSlug={orgSlug} onAdded={handleRefresh} />
      </div>

      {members.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No hay miembros en esta organización
        </div>
      ) : (
        <MembersTable
          orgSlug={orgSlug}
          members={members}
          onUpdated={handleRefresh}
        />
      )}
    </>
  );
}
