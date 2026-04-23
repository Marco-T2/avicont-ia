"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type MemberRole =
  | "owner"
  | "admin"
  | "contador"
  | "cobrador"
  | "member"
  | null;

export function useOrgRole() {
  const params = useParams();
  const orgSlug = params?.orgSlug as string | undefined;
  const [role, setRole] = useState<MemberRole>(null);
  // Start as false when no slug is available — nothing to load
  const [isLoading, setIsLoading] = useState(() => !!orgSlug);

  useEffect(() => {
    if (!orgSlug) {
      // No slug: nothing to fetch; state is already at the correct initial values
      return;
    }

    const run = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/organizations/${orgSlug}/members/me`);
        const data = res.ok ? await res.json() : null;
        setRole(data?.role ?? null);
      } catch {
        setRole(null);
      } finally {
        setIsLoading(false);
      }
    };
    run();
  }, [orgSlug]);

  return { role, isLoading, orgSlug };
}
