"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminTripStats } from "@/hooks/useAdminTrips";
import { useUsers } from "@/hooks/useUser";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { ReimbursementAlert } from "@/components/admin/ReimbursementAlert";

export default function AdminDashboard() {
  const router = useRouter();
  const { data: allTrips, isLoading: loadingTrips } = useAdminTripStats();
  const { users, isLoading: loadingUsers } = useUsers();
  const isLoading = loadingTrips || loadingUsers;

  // --- Métricas globales ---
  const totalTrips = allTrips?.length ?? 0;
  const totalAmount =
    allTrips?.reduce((acc, t) => acc + Number(t.totalAmount ?? 0), 0) ?? 0;
  const usersActivos = users?.filter((u) => u.role === "USER").length ?? 0;

  // Contar por estado
  const tripsByStatus = {
    PENDIENTE: allTrips?.filter((t) => t.status === "PENDIENTE").length ?? 0,
    APROBADO: allTrips?.filter((t) => t.status === "APROBADO").length ?? 0,
    RECHAZADO: allTrips?.filter((t) => t.status === "RECHAZADO").length ?? 0,
  };

  // ✅ Gasto por usuario — ahora iteramos assignedUsers (array)
  // Un trip puede estar asignado a varios usuarios: lo contamos para cada uno
  const spendByUser = (() => {
    const map = new Map<
      string,
      { name: string; email: string; total: number; trips: number }
    >();

    allTrips?.forEach((trip) => {
      const amount = Number(trip.totalAmount ?? 0);

      // ✅ assignedUsers es un array de TripAssignment
      trip.assignedUsers?.forEach((assignment) => {
        const userId = assignment.userId;
        const name = assignment.user?.name ?? "Sin nombre";
        const email = assignment.user?.email ?? "";

        const existing = map.get(userId);
        if (existing) {
          existing.total += amount;
          existing.trips += 1;
        } else {
          map.set(userId, { name, email, total: amount, trips: 1 });
        }
      });
    });

    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  })();

  // Ciudades más visitadas
  const topCities = (() => {
    const map = new Map<string, number>();
    allTrips?.forEach((t) => {
      if (t.city) map.set(t.city, (map.get(t.city) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  })();

  return (
    <main className="flex flex-col gap-6 p-6">
      <ReimbursementAlert />
      <section className="flex flex-col items-center gap-4 md:flex-row md:items-center md:justify-between">
        <div className="text-center md:text-left">
          <h1 className="text-3xl font-bold">Dashboard Administrador</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Resumen global de viajes y gastos
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            onClick={() => router.push("/admin/alltrips")}
            className="w-full sm:w-auto"
          >
            Gestionar viajes
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push("/admin")}
            className="w-full sm:w-auto"
          >
            Ver tabla
          </Button>
        </div>
      </section>

      {/* KPIs globales */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Total viajes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-9 w-16" />
            ) : (
              <p className="text-3xl font-bold">{totalTrips}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Gasto total
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-9 w-32" />
            ) : (
              <p className="text-3xl font-bold">
                {totalAmount.toLocaleString("es-ES", {
                  style: "currency",
                  currency: "EUR",
                })}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Usuarios activos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-9 w-12" />
            ) : (
              <p className="text-3xl font-bold">{usersActivos}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-yellow-600">
              Pendientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-9 w-12" />
            ) : (
              <p className="text-3xl font-bold text-yellow-600">
                {tripsByStatus.PENDIENTE}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Estados */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-yellow-600">
              Pendientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <p className="text-2xl font-bold">{tripsByStatus.PENDIENTE}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-green-600">Aprobados</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <p className="text-2xl font-bold">{tripsByStatus.APROBADO}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-red-600">Rechazados</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <p className="text-2xl font-bold">{tripsByStatus.RECHAZADO}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Gasto por usuario + ciudades */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Gasto por usuario (top 5)</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : spendByUser.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No hay datos disponibles
              </p>
            ) : (
              <ul className="space-y-3">
                {spendByUser.map((u) => (
                  <li
                    key={u.email}
                    className="flex justify-between items-center py-2 border-b last:border-0"
                  >
                    <div>
                      <span className="font-medium">{u.name}</span>
                      <p className="text-xs text-muted-foreground">
                        {u.email} · {u.trips}{" "}
                        {u.trips === 1 ? "viaje" : "viajes"}
                      </p>
                    </div>
                    <span className="font-semibold">
                      {u.total.toLocaleString("es-ES", {
                        style: "currency",
                        currency: "EUR",
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ciudades más visitadas</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : topCities.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No hay datos disponibles
              </p>
            ) : (
              <ul className="space-y-3">
                {topCities.map(([city, count]) => (
                  <li
                    key={city}
                    className="flex justify-between items-center py-2 border-b last:border-0"
                  >
                    <span className="font-medium">{city}</span>
                    <span className="text-muted-foreground">
                      {count} {count === 1 ? "viaje" : "viajes"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
