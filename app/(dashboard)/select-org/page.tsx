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
} from "lucide-react";
import { toast } from "sonner";

export default function SelectOrgPage() {
  const { user } = useUser();
  const { isLoaded, userMemberships, setActive, createOrganization } =
    useOrganizationList({
      userMemberships: {
        infinite: true,
      },
    });

  const router = useRouter();
  const [orgName, setOrgName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Function to manually refresh organization list
  const refreshOrganizations = async () => {
    setIsRefreshing(true);
    try {
      if (userMemberships?.revalidate) {
        await userMemberships.revalidate();
      }
      toast.success("Organization list refreshed");
    } catch (error) {
      console.error("Failed to refresh organizations:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCreateOrg = async () => {
    if (!orgName.trim()) {
      toast.error("Please enter an organization name");
      return;
    }

    setIsCreating(true);
    try {
      // 1. Create organization in Clerk
      if (!createOrganization) {
        throw new Error("Organization creation is not available at this time.");
      }
      const newOrg = await createOrganization({
        name: orgName.trim(),
      });

      if (!newOrg) {
        throw new Error("Failed to create organization");
      }

      toast.success(`Organization "${orgName}" created successfully`);
      setOrgName("");

      // 2. Save to your database (optional)
      try {
        const response = await fetch("/api/organizations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clerkOrgId: newOrg.id,
            name: orgName.trim(),
            slug:
              //replaces all sequences of whitespace characters (matched by the regular expression /\s+/g) with a single hyphen (-)
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

      // 3. Set as active organization
      if (setActive) {
        await setActive({
          organization: newOrg.id,
        });
      }

      // 4. IMPORTANT: Force refresh of organization list
      // Wait a moment for Clerk to propagate changes
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Refresh the organization list
      refreshOrganizations();

      router.refresh(); // Refresh server components
    } catch (error: any) {
      console.error("Failed to create organization:", error);
      toast.error(error.message || "Failed to create organization");
    } finally {
      setIsCreating(false);
    }
  };

  const handleSelectOrg = async (organization: any) => {
    try {
      if (setActive) {
        await setActive({
          organization: organization.id,
        });
      }
      router.push(`/${organization.slug}`);
    } catch (error) {
      console.error("Failed to switch organization:", error);
      toast.error("Failed to switch organization");
    }
  };

  // Debug: Log current organization list
  console.log("Current organization list:", {
    isLoaded,
    count: userMemberships?.count,
    data: userMemberships?.data?.map((org) => org.organization.name),
  });

  return (
    <div className="container max-w-4xl mx-auto p-6">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold">Welcome, {user?.firstName}!</h1>
        <p className="text-gray-600">Select or create an organization</p>
      </div>

      {/* Create Organization */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Create New Organization
              </CardTitle>
              <CardDescription>
                Start a new workspace for your team
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Enter organization name"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                disabled={isCreating}
                className="flex-1"
                onKeyDown={(e) => e.key === "Enter" && handleCreateOrg()}
              />
              <Button
                onClick={handleCreateOrg}
                disabled={isCreating || !orgName.trim()}
                className="min-w-25]"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create"
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Your Organizations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Your Organizations ({userMemberships?.count || 0})
          </CardTitle>
          <CardDescription>
            {userMemberships?.count === 0
              ? "Create your first organization above"
              : "Click on an organization to enter"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {userMemberships?.count === 0 ? (
            <div className="text-center py-12">
              <Building className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">No organizations yet</p>
              <p className="text-sm text-gray-500">
                Create your first organization to get started
              </p>
            </div>
          ) : (
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
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <span className="bg-gray-100 px-2 py-1 rounded text-xs capitalize">
                            {membership.role}
                          </span>
                          <span>•</span>
                          <span>
                            ID: {membership.organization.id.substring(0, 8)}...
                          </span>
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-gray-400" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}