import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { syncUserToDatabase } from "@/modules/auth/application/sync-user.service";
import { makeUsersService } from "@/modules/users/presentation/composition-root";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  await syncUserToDatabase(makeUsersService());

  return (
    <div className="h-full">{children}</div>
  );
}