"use client";

import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface RoleOption {
  slug: string;
  name: string;
  isSystem: boolean;
}

interface RolePickerProps {
  orgSlug: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

/**
 * RolePicker — fetches /api/organizations/[orgSlug]/roles on mount,
 * filters out the 'owner' slug (not assignable by admin), and renders
 * a Select with the remaining roles.
 *
 * PR7.2 / REQ U.4mod-S1, U.4mod-S2
 */
export default function RolePicker({
  orgSlug,
  value,
  onChange,
  disabled = false,
}: RolePickerProps) {
  const [roles, setRoles] = useState<RoleOption[]>([]);

  useEffect(() => {
    fetch(`/api/organizations/${orgSlug}/roles`)
      .then((r) => r.json())
      .then((data: { roles: RoleOption[] }) => {
        // owner is implicit — created with the org, not assignable by admin
        setRoles(data.roles.filter((r) => r.slug !== "owner"));
      })
      .catch(() => {
        // fallback: leave empty — the form will remain blocked
      });
  }, [orgSlug]);

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {roles.map((role) => (
          <SelectItem key={role.slug} value={role.slug}>
            {role.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
