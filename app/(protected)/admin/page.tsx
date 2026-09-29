"use client";

import { useState } from "react";
import {
  useAdminTripsTable,
  useUpdateTripStatus,
  useExportExcel,
  useExportTripsSummary,
} from "@/hooks/useAdminTrips";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";
import { Trip, TripStatus } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileSpreadsheet,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
} from "lucide-react";
import { useUsers } from "@/hooks/useUser";
import PendingTripRequests from "@/components/admin/PendingTripRequests";
import {
  TRIP_STATUS_OPTIONS,
  TRIP_STATUS_SHORT_LABEL,
  TRIP_STATUS_VARIANT,
} from "@/lib/trip-status";

export default function AdminPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 15;

  const [filterUserId, setFilterUserId] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<TripStatus | "">("");

  const { data, isLoading } = useAdminTripsTable(currentPage, limit);
  const { users } = useUsers();
  const updateStatus = useUpdateTripStatus();
  const exportExcel = useExportExcel();
  const exportSummary = useExportTripsSummary();

  // Etiquetas y variantes vienen de lib/trip-status.ts (fuente única)
  const STATUS_OPTIONS = TRIP_STATUS_OPTIONS;

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-8 space-y-6">
        <Skeleton className="h-10 w-96" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  let trips = data?.trips ?? [];
  const pagination = data?.pagination;

  if (filterUserId) {
    trips = trips.filter((t) =>
      t.assignedUsers?.some((a) => a.userId === filterUserId),
    );
  }
  if (filterStatus) {
    trips = trips.filter((t) => t.status === filterStatus);
  }

  // Usuarios disponibles para filtrar (solo USERs)
  const availableUsers = users?.filter((u) => u.role === "USER") ?? [];

  return (
    <div className="max-w-7xl mx-auto p-8 space-y-6">
      <div className="flex flex-col items-center gap-4 md:flex-row md:items-center md:justify-between">
        <div className="text-center md:text-left">
          <h1 className="text-4xl font-bold">Panel de Control</h1>
          {pagination && (
            <p className="text-sm text-muted-foreground mt-1">
              Mostrando {(pagination.page - 1) * pagination.limit + 1}–
              {Math.min(
                pagination.page * pagination.limit,
                pagination.totalCount,
              )}{" "}
              de {pagination.totalCount} viajes
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto mb-3">
          {/* Ir a gestión de cards */}
          <Button variant="outline" asChild>
            <Link href="/admin/alltrips">
              <Plus className="w-4 h-4 mr-2" />
              Gestionar Viajes
            </Link>
          </Button>

          {/* 🆕 Resumen de viajes: una fila por viaje, sin gastos */}
          <Button
            variant="outline"
            onClick={() => exportSummary.mutate()}
            disabled={exportSummary.isPending}
          >
            {exportSummary.isPending ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                Generando...
              </>
            ) : (
              <>
                <ClipboardList className="w-4 h-4 mr-2" />
                Resumen de viajes
              </>
            )}
          </Button>

          {/* Exportar Excel de gastos (una fila por gasto, 27 columnas) */}
          <Button
            onClick={() => exportExcel.mutate()}
            disabled={exportExcel.isPending}
          >
            {exportExcel.isPending ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Exportando...
              </>
            ) : (
              <>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Exportar gastos
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 🆕 Lo primero: solicitudes esperando aprobación (no pinta nada si no hay) */}
      <PendingTripRequests />

      {/* ✅ Filtros */}
      <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-end bg-muted/50 p-4 rounded-lg border">
        <div className="flex-1">
          <label className="text-sm font-medium mb-2 block">
            Filtrar por usuario
          </label>
          <Select
            value={filterUserId || "all"}
            onValueChange={(val) => setFilterUserId(val === "all" ? "" : val)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos los usuarios" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los usuarios</SelectItem>
              {availableUsers.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1">
          <label className="text-sm font-medium mb-2 block">
            Filtrar por estado
          </label>
          <Select
            value={filterStatus || "all"}
            onValueChange={(val) =>
              setFilterStatus(val === "all" ? "" : (val as TripStatus))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos los estados" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {TRIP_STATUS_SHORT_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Botón limpiar filtros */}
        {(filterUserId || filterStatus) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFilterUserId("");
              setFilterStatus("");
            }}
            className="gap-2 sm:self-end"
          >
            <X className="w-4 h-4" />
            Limpiar filtros
          </Button>
        )}
      </div>
      {trips.length > 0 ? (
        <>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ciudad</TableHead>
                  <TableHead>Nº Factura</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Fechas</TableHead>
                  <TableHead>Docs.</TableHead>
                  <TableHead className="text-right">Gastos</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trips.map((trip: Trip) => (
                  <TableRow key={trip.id}>
                    <TableCell className="font-medium">{trip.city}</TableCell>
                    {/* 🆕 Nº de factura interno, visible sin abrir el viaje */}
                    <TableCell className="text-sm">
                      {trip.numberInvoice ? (
                        trip.numberInvoice
                      ) : (
                        <span className="text-amber-600">Sin asignar</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {trip.assignedUsers && trip.assignedUsers.length > 0 ? (
                        <div>
                          {trip.assignedUsers.map((a) => (
                            <div key={a.userId}>
                              <div className="font-medium">{a.user?.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {a.user?.email}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">
                          Sin asignar
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(trip.startDate)} — {formatDate(trip.endDate)}
                    </TableCell>
                    {/* 🆕 Billete comprado / hotel reservado, de un vistazo */}
                    <TableCell>
                      <div className="flex gap-1 text-xs">
                        <span
                          title="Billete"
                          className={
                            trip.documents?.some((d) => d.type === "BILLETE")
                              ? "text-green-600"
                              : "text-muted-foreground"
                          }
                        >
                          ✈️
                          {trip.documents?.some((d) => d.type === "BILLETE")
                            ? "✓"
                            : "✗"}
                        </span>
                        <span
                          title="Reserva de hotel"
                          className={
                            trip.documents?.some((d) => d.type === "RESERVA")
                              ? "text-green-600"
                              : "text-muted-foreground"
                          }
                        >
                          🏨
                          {trip.documents?.some((d) => d.type === "RESERVA")
                            ? "✓"
                            : "✗"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {trip.expenses?.length ?? 0}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(trip.totalAmount)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant={TRIP_STATUS_VARIANT[trip.status]}>
                          {TRIP_STATUS_SHORT_LABEL[trip.status]}
                        </Badge>
                        <Select
                          value={trip.status}
                          onValueChange={(status) =>
                            updateStatus.mutate({
                              tripId: trip.id,
                              status: status as TripStatus,
                            })
                          }
                          disabled={updateStatus.isPending}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((s) => (
                              <SelectItem key={s} value={s}>
                                {TRIP_STATUS_SHORT_LABEL[s]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/admin/trips/${trip.id}/expenses`}>
                          Ver Gastos
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Paginación */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Página {pagination.page} de {pagination.totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={pagination.page === 1}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => p + 1)}
                  disabled={!pagination.hasMore}
                >
                  Siguiente
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-16 border rounded-lg text-muted-foreground">
          <p className="mb-4">
            {filterUserId || filterStatus
              ? "No hay viajes que coincidan con los filtros seleccionados"
              : "No hay viajes registrados"}
          </p>
          {(filterUserId || filterStatus) && (
            <Button
              variant="outline"
              onClick={() => {
                setFilterUserId("");
                setFilterStatus("");
              }}
            >
              Limpiar filtros
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
