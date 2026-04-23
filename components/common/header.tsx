"use client"
import { Brain, Home, LogIn, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RoleBadge } from "@/components/common/role-badge";
import { useOrganization, UserButton, useUser } from "@clerk/nextjs";

export default function Header() {
    const pathname = usePathname();
    const { user, isSignedIn } = useUser();
    const { organization } = useOrganization();

    const navItems = [
        { href: "/", label: "Inicio", icon: <Home className="w-4 h-4" /> },
        { href: "/select-org", label: "Cambiar Organización", icon: <Users className="w-4 h-4" /> },
    ];

    return (
        <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-backdrop-filter:bg-white/60">
            <div className="px-4 lg:px-8 h-16 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2 font-bold text-xl">
                    <Brain className="w-6 h-6 text-blue-600" />
                    Avicont-AI
                </Link>

                <nav className="hidden md:flex items-center gap-1">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                        return (
                            <Link key={item.href} href={item.href}>
                                <Button variant={isActive ? "secondary" : "ghost"} size="sm" className="gap-2">
                                    {item.icon}
                                    {item.label}
                                </Button>
                            </Link>
                        )
                    })}
                </nav>

                <div className="flex items-center gap-4">
                    {isSignedIn ? (
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600">
                                {organization ? `En ${organization.name}` : user?.firstName || user?.username}
                            </span>
                            <RoleBadge />
                            <UserButton />
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <Link href="/sign-in">
                                <Button variant="ghost" size="sm">
                                    <LogIn className="h-4 w-4 mr-1" />
                                    Iniciar Sesión
                                </Button>
                            </Link>
                            <Link href="/sign-up">
                                <Button size="sm">
                                    <UserPlus className="h-4 w-4 mr-1" />
                                    Registrarse
                                </Button>
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </header>
    )
}
