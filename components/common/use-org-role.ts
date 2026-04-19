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
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!orgSlug) {
      setRole(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    fetch(`/api/organizations/${orgSlug}/members/me`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setRole(data?.role ?? null))
      .catch(() => setRole(null))
      .finally(() => setIsLoading(false));
  }, [orgSlug]);

  return { role, isLoading, orgSlug };
}
