import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { syncUserToDatabase } from "@/features/auth";

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
    <div className="min-h-full">{children}</div>
  );
}