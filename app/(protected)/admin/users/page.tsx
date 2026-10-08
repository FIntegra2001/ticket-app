"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserContext } from "@/context/userContext";
import { formatDate } from "@/lib/utils";

type UserStatus = "PENDIENTE" | "ACTIVO" | "BLOQUEADO";
type AdminUser = {
  id: string;
  name: string | null;
  email: string;
  role: "USER" | "ADMIN";
  status: UserStatus;
  createdAt: string;
};

const STATUS_STYLE: Record<UserStatus, string> = {
  PENDIENTE: "bg-amber-100 text-amber-800",
  ACTIVO: "bg-green-100 text-green-800",
  BLOQUEADO: "bg-red-100 text-red-800",
};

export default function AdminUsersPage() {
  const { user: me } = useUserContext();
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery<AdminUser[]>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Error al cargar usuarios");
      return res.json();
    },
  });

  const update = useMutation({
    mutationFn: async ({
      id,
      ...data
    }: { id: string; status?: UserStatus; role?: "USER" | "ADMIN" }) => {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Error al actualizar");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Usuario actualizado");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users-pending"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pending = users.filter((u) => u.status === "PENDIENTE");
  const others = users.filter((u) => u.status !== "PENDIENTE");

  const card = (u: AdminUser) => {
    const isMe = u.id === me?.id;
    return (
      <div
        key={u.id}
        className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center gap-3"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-gray-900">{u.name ?? "—"}</span>
            <Badge className={STATUS_STYLE[u.status]}>{u.status}</Badge>
            {u.role === "ADMIN" && <Badge variant="outline">ADMIN</Badge>}
          </div>
          <p className="text-sm text-gray-600 truncate">{u.email}</p>
          <p className="text-xs text-gray-400">Alta: {formatDate(u.createdAt)}</p>
        </div>
        {!isMe && (
          <div className="flex gap-2 flex-wrap">
            {u.status !== "ACTIVO" && (
              <Button
                size="sm"
                disabled={update.isPending}
                onClick={() => update.mutate({ id: u.id, status: "ACTIVO" })}
              >
                Aprobar
              </Button>
            )}
            {u.status !== "BLOQUEADO" && (
              <Button
                size="sm"
                variant="destructive"
                disabled={update.isPending}
                onClick={() => {
                  if (confirm(`¿Bloquear el acceso de ${u.email}?`)) {
                    update.mutate({ id: u.id, status: "BLOQUEADO" });
                  }
                }}
              >
                {u.status === "PENDIENTE" ? "Rechazar" : "Bloquear"}
              </Button>
            )}
            {u.status === "ACTIVO" && (
              <Button
                size="sm"
                variant="outline"
                disabled={update.isPending}
                onClick={() => {
                  const role = u.role === "ADMIN" ? "USER" : "ADMIN";
                  if (confirm(`¿Cambiar el rol de ${u.email} a ${role}?`)) {
                    update.mutate({ id: u.id, role });
                  }
                }}
              >
                {u.role === "ADMIN" ? "Quitar admin" : "Hacer admin"}
              </Button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-800">
              Pendientes de aprobar ({pending.length})
            </h2>
            {pending.length === 0 ? (
              <p className="text-sm text-gray-500">No hay solicitudes de acceso.</p>
            ) : (
              pending.map(card)
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-800">
              Todos los usuarios ({others.length})
            </h2>
            {others.map(card)}
          </section>
        </>
      )}
    </div>
  );
}
