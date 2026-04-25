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

  // next-themes lee localStorage sincronicamente en el cliente, entonces el
  // primer render del cliente ya conoce el tema mientras el server no. Para
  // evitar hydration mismatch diferimos TODO el contenido dependiente del tema
  // (icono, aria-label, label visible) hasta post-mount.
  useEffect(() => setMounted(true), []);

  const isDark = mounted && theme === "dark";
  const ariaLabel = mounted
    ? isDark
      ? "Cambiar a tema claro"
      : "Cambiar a tema oscuro"
    : "Cambiar tema";
  const visibleLabel = mounted ? (isDark ? "Tema claro" : "Tema oscuro") : "Tema";

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
