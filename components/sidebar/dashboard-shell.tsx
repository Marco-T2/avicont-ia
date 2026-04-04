"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Menu } from "lucide-react";
import { SidebarProvider, useSidebar } from "./sidebar-provider";
import { AppSidebar } from "./app-sidebar";
import { AgentChat } from "@/components/agent/agent-chat";
import { Button } from "@/components/ui/button";

function DashboardShellInner({ children }: { children: React.ReactNode }) {
  const [agentChatOpen, setAgentChatOpen] = useState(false);
  const { toggleMobile } = useSidebar();
  const params = useParams();
  const orgSlug = params?.orgSlug as string;

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      <AppSidebar onOpenAgentChat={() => setAgentChatOpen(true)} />

      <div className="flex flex-1 flex-col min-w-0">
        {/* Mobile header with menu toggle */}
        <div className="flex items-center border-b px-4 py-2 md:hidden">
          <Button variant="ghost" size="icon-sm" onClick={toggleMobile}>
            <Menu className="h-5 w-5" />
          </Button>
        </div>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>

      <AgentChat
        isOpen={agentChatOpen}
        onClose={() => setAgentChatOpen(false)}
        orgSlug={orgSlug}
      />
    </div>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <DashboardShellInner>{children}</DashboardShellInner>
    </SidebarProvider>
  );
}
