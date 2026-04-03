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
    <div className="bg-gray-50">
      {/* Main Content - Global header now handles navigation */}
      <div className="py-8">
        <div className="container mx-auto px-4">{children}</div>
      </div>
    </div>
  );
}