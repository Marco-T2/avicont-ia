"use client";

/**
 * NewGestionButton — header CTA that opens the period-create dialog.
 *
 * Extracted from `annual-period-list.tsx` so the page header can render the
 * button on the same row as the title (eliminates the dead vertical space
 * that appeared when the button lived inside the list's own grid).
 *
 * The empty-state CTA inside `AnnualPeriodList` keeps its own dialog
 * instance — they're never both rendered at the same time (page conditions
 * on `isEmpty` to pick which one shows).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import PeriodCreateDialog from "./period-create-dialog";

interface NewGestionButtonProps {
  orgSlug: string;
}

export default function NewGestionButton({ orgSlug }: NewGestionButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        Nueva gestión
      </Button>

      <PeriodCreateDialog
        orgSlug={orgSlug}
        open={open}
        onOpenChange={setOpen}
        onCreated={() => {
          setOpen(false);
          router.refresh();
        }}
      />
    </>
  );
}
