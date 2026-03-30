import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Main Content - Global header now handles navigation */}
      <main className="py-8">
        <div className="container mx-auto px-4">{children}</div>
      </main>
    </div>
  );
}