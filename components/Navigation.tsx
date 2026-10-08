/* eslint-disable @next/next/no-img-element */
"use client";

import { useUserContext } from "@/context/userContext";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { UserBadge } from "./UserBadge";

export default function Navigation() {
  const pathname = usePathname();
  const { user } = useUserContext();

  // Aviso al ADMIN de cuentas pendientes de aprobar (comparte caché con /admin/users)
  const { data: pendingUsers = 0 } = useQuery({
    queryKey: ["admin-users-pending"],
    enabled: user?.role === "ADMIN",
    refetchInterval: 60_000,
    queryFn: async () => {
      const res = await fetch("/api/admin/users");
      if (!res.ok) return 0;
      const users: { status: string }[] = await res.json();
      return users.filter((u) => u.status === "PENDIENTE").length;
    },
  });

  const isActive = (path: string) => {
    return pathname === path;
  };

  return (
    <header className="bg-white backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link
            href={user?.role === "ADMIN" ? "/admin/dashboard" : "/dashboard"}
            className="flex items-center space-x-3"
          >
            <img src="/logo.png" alt="Logo" width={64} height={64} />
            <span className="text-md font-bold text-gray-900">Inicio</span>
          </Link>

          <nav className="flex items-center space-x-2 sm:space-x-6">
            {/* 🆕 Gastos de oficina: el USER va a sus partes, el ADMIN al panel
                con los de todos. Es el único acceso a la sección, así que va en
                el nav y no solo en el dashboard. */}
            {user && (
              <Link
                href={
                  user.role === "ADMIN"
                    ? "/admin/office-expenses"
                    : "/office-expenses"
                }
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive("/office-expenses") ||
                  isActive("/admin/office-expenses")
                    ? "text-indigo-600 bg-indigo-50"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Gastos oficina
              </Link>
            )}

            {user?.role === "ADMIN" && (
              <Link
                href="/admin"
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive("/admin")
                    ? "text-indigo-600 bg-indigo-50"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Viajes
              </Link>
            )}
            {user?.role === "ADMIN" && (
              <Link
                href="/admin/users"
                className={`relative px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive("/admin/users")
                    ? "text-indigo-600 bg-indigo-50"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Usuarios
                {pendingUsers > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-amber-500 text-white text-xs flex items-center justify-center">
                    {pendingUsers}
                  </span>
                )}
              </Link>
            )}
            {user?.role === "USER" && (
              <Link
                href="/trips"
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive("/trips")
                    ? "text-indigo-600 bg-indigo-50"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Viajes
              </Link>
            )}


            {user && <UserBadge />}

            {!user && (
              <Link
                href="/auth"
                className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Sign In
              </Link>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
