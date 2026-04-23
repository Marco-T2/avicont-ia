"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "./sidebar-provider";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Resource } from "@/features/shared/permissions";

interface NavSubItem {
  label: string;
  href?: string;
  isSeparator?: boolean;
  /**
   * PR4: Optional per-child RBAC resource. When present, callers may use it
   * to gate visibility (matrix.canAccess(resource, "read")). Optional for
   * backward compatibility — existing usages without `resource` continue
   * to work exactly as before.
   *
   * Note: <ActiveModuleNav> performs the RBAC filter at the parent level
   * before passing navItems here; this field is provided primarily as a
   * type-level affordance for other callers that may want to thread a
   * resource through.
   */
  resource?: Resource;
}

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  href?: string;
  onClick?: () => void;
  children?: NavSubItem[];
}

export function NavItem({ icon, label, href, onClick, children }: NavItemProps) {
  const pathname = usePathname();
  const { isCollapsed } = useSidebar();

  const isActive = href
    ? pathname === href || pathname.startsWith(href + "/")
    : false;

  const hasChildren = children && children.length > 0;

  const childActive = hasChildren
    ? children.some(
        (child) =>
          !child.isSeparator &&
          child.href !== undefined &&
          (pathname === child.href || pathname.startsWith(child.href + "/"))
      )
    : false;

  const [manuallyExpanded, setManuallyExpanded] = useState(false);

  // Auto-expand when a child route is active; user can still collapse via toggle
  const isExpanded = childActive || manuallyExpanded;

  const itemClasses = cn(
    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
    "hover:bg-accent hover:text-accent-foreground",
    (isActive || childActive) && "bg-accent text-accent-foreground",
    isCollapsed && "justify-center px-2"
  );

  const handleClick = () => {
    if (onClick) {
      onClick();
      return;
    }
    if (hasChildren) {
      setManuallyExpanded((prev) => !prev);
    }
  };

  const content = (
    <>
      <span className="shrink-0">{icon}</span>
      {!isCollapsed && (
        <>
          <span className="flex-1 truncate">{label}</span>
          {hasChildren && (
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 transition-transform",
                isExpanded && "rotate-180"
              )}
            />
          )}
        </>
      )}
    </>
  );

  const wrappedContent = isCollapsed ? (
    <Tooltip>
      <TooltipTrigger asChild>
        {href && !hasChildren ? (
          <Link href={href} className={itemClasses}>
            {content}
          </Link>
        ) : (
          <button type="button" onClick={handleClick} className={cn(itemClasses, "w-full")}>
            {content}
          </button>
        )}
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  ) : href && !hasChildren ? (
    <Link href={href} className={itemClasses}>
      {content}
    </Link>
  ) : (
    <button type="button" onClick={handleClick} className={cn(itemClasses, "w-full")}>
      {content}
    </button>
  );

  return (
    <div>
      {wrappedContent}
      {hasChildren && isExpanded && !isCollapsed && (
        <div className="ml-4 mt-1 flex flex-col gap-0.5 border-l pl-3">
          {children.map((child, index) => {
            if (child.isSeparator) {
              return (
                <div
                  key={`sep-${index}`}
                  className="mt-2 mb-1 px-3 flex items-center gap-2"
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    {child.label}
                  </span>
                  <div className="flex-1 h-px bg-border/60" />
                </div>
              );
            }
            const subActive =
              pathname === child.href ||
              pathname.startsWith((child.href ?? "") + "/");
            return (
              <Link
                key={child.href}
                href={child.href!}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  "hover:bg-accent hover:text-accent-foreground",
                  subActive && "bg-accent/60 text-accent-foreground font-medium"
                )}
              >
                {child.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
