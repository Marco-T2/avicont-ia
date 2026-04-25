"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/sidebar/sidebar-provider";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { isCollapsed } = useSidebar();
  const [mounted, setMounted] = useState(false);

  // next-themes returns undefined until hydration completes; defer the icon
  // swap so server and client render the same markup on first paint.
  useEffect(() => setMounted(true), []);

  const isDark = theme === "dark";
  const ariaLabel = isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro";
  const visibleLabel = isDark ? "Tema claro" : "Tema oscuro";

  const handleClick = () => {
    setTheme(isDark ? "light" : "dark");
  };

  const buttonClasses = cn(
    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors w-full",
    "hover:bg-accent hover:text-accent-foreground",
    isCollapsed && "justify-center px-2",
  );

  const icon = !mounted ? null : isDark ? (
    <Sun className="h-5 w-5" />
  ) : (
    <Moon className="h-5 w-5" />
  );

  const button = (
    <button
      type="button"
      onClick={handleClick}
      aria-label={ariaLabel}
      className={buttonClasses}
    >
      <span className="shrink-0">{icon}</span>
      {!isCollapsed && (
        <span className="flex-1 truncate text-left">{visibleLabel}</span>
      )}
    </button>
  );

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right">{visibleLabel}</TooltipContent>
      </Tooltip>
    );
  }

  return button;
}
