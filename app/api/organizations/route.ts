import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { clerkOrgId, name, slug } = body;

    if (!clerkOrgId || !name) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Check if organization already exists
    const existingOrg = await prisma.organization.findUnique({
      where: { clerkOrgId },
    });

    if (existingOrg) {
      return NextResponse.json({
        success: true,
        organization: existingOrg,
        message: "Organization already exists",
      });
    }

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      // Create user if doesn't exist
      user = await prisma.user.create({
        data: {
          clerkUserId: userId,
          email: `${userId}@temp.com`,
          name: "User",
        },
      });
    }

    // Create organization in database
    const organization = await prisma.organization.create({
      data: {
        clerkOrgId,
        name,
        slug: slug || name.toLowerCase().replace(/\s+/g, "-"),
      },
    });

    // Create membership for the creator
    await prisma.organizationMember.create({
      data: {
        userId: user.id,
        organizationId: organization.id,
        role: "owner",
      },
    });

    return NextResponse.json({
      success: true,
      organization,
      message: "Organization created successfully",
    });
  } catch (error: any) {
    console.error("[ORGANIZATIONS_POST]", error);
    return NextResponse.json(
      { error: error.message || "Failed to create organization" },
      { status: 500 },
    );
  }
}