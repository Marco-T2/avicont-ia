"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import RegistrarConIAModal from "@/components/agent/registrar-con-ia";
import type { ContextHints } from "@/components/agent/registrar-con-ia/types";

interface RegistrarConIABotonProps {
  orgSlug: string;
  contextHints: ContextHints;
}

export default function RegistrarConIABoton({
  orgSlug,
  contextHints,
}: RegistrarConIABotonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="lg" onClick={() => setOpen(true)}>
        🤖 Registrar con IA
      </Button>
      <RegistrarConIAModal
        orgSlug={orgSlug}
        open={open}
        onOpenChange={setOpen}
        contextHints={contextHints}
      />
    </>
  );
}
