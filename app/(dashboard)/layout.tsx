import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { syncUserToDatabase } from "@/features/auth/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  await syncUserToDatabase();

  return (
    <div className="h-full">{children}</div>
  );
}