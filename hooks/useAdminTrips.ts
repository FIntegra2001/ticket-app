"use client";

import {
  useInfiniteQuery,
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { Trip, TripStatus, PaginatedResponse, CreateTripDto, UpdateTripDto } from "@/types";
import { toast } from "sonner";

export function useAdminTrips() {
  return useInfiniteQuery<PaginatedResponse<Trip>>({
    queryKey: ["adminTrips"],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await fetch(`/api/admin/trips?page=${pageParam}&limit=9`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Error fetching admin trips");
      }
      return res.json();
    },
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? lastPage.pagination.page + 1 : undefined,
    initialPageParam: 1,
  });
}

/**
 * 🆕 Solicitudes pendientes de aprobación, para el bloque de revisión del panel.
 * Filtra en servidor (?status=PENDIENTE) en vez de traerse todos los viajes.
 */
export function usePendingTrips(limit: number = 50) {
  return useQuery<PaginatedResponse<Trip>>({
    queryKey: ["pendingTrips", limit],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/trips?status=PENDIENTE&page=1&limit=${limit}`,
        {
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        },
      );
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Error fetching pending trips");
      }
      return res.json();
    },
  });
}

export function useAdminTripsTable(page: number = 1, limit: number = 15) {
  return useQuery<PaginatedResponse<Trip>>({
    queryKey: ["adminTripsTable", page, limit],
    queryFn: async () => {
      const res = await fetch(`/api/admin/trips?page=${page}&limit=${limit}`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Error fetching admin trips");
      }
      return res.json();
    },
  });
}

export function useAdminTrip(tripId: string) {
  return useQuery<Trip>({
    queryKey: ["adminTrip", tripId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/trips/${tripId}`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Error fetching trip");
      }
      return res.json();
    },
    enabled: !!tripId,
  });
}

export function useAdminTripStats() {
  return useQuery<Trip[]>({
    queryKey: ["adminTripStats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/trips/stats", {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Error fetching admin trip stats");
      }
      return res.json();
    },
  });
}

export function useCreateTrip() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateTripDto) => {
      const res = await fetch("/api/trips", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Error creating trip");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminTrips"] });
      queryClient.invalidateQueries({ queryKey: ["adminTripsTable"] });
      queryClient.invalidateQueries({ queryKey: ["adminTripStats"] });
      queryClient.invalidateQueries({ queryKey: ["pendingTrips"] });
      // ✅ Invalidar trips de usuario: el nuevo trip aparecerá en su lista
      queryClient.invalidateQueries({ queryKey: ["trips"] });
    },
    onError: (error) => console.error("Error creating trip:", error),
  });
}

export function useUpdateTrip() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tripId, data }: { tripId: string; data: Partial<UpdateTripDto> }) => {
      const res = await fetch(`/api/admin/trips/${tripId}`, { // ← CAMBIADO
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Error updating trip");
      }
      return res.json();
    },
    onSuccess: (updatedTrip: Trip) => {
      queryClient.invalidateQueries({ queryKey: ["adminTrips"] });
      queryClient.invalidateQueries({ queryKey: ["adminTripsTable"] });
      queryClient.invalidateQueries({ queryKey: ["adminTripStats"] });
      queryClient.invalidateQueries({ queryKey: ["pendingTrips"] });
      queryClient.invalidateQueries({ queryKey: ["adminTrip", updatedTrip.id] });
      queryClient.setQueryData<Trip>(["adminTrip", updatedTrip.id], updatedTrip);
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      queryClient.invalidateQueries({ queryKey: ["trip", updatedTrip.id] });
    },
    onError: (error) => console.error("Error updating trip:", error),
  });
}

// ✅ FIX: usar /api/admin/trips/${tripId} en lugar de /api/trips/${tripId}
export function useDeleteTrip() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tripId: string) => {
      const res = await fetch(`/api/admin/trips/${tripId}`, { // ← CAMBIADO
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Error deleting trip");
      }
      return res.json();
    },
    onSuccess: (_, tripId) => {
      queryClient.invalidateQueries({ queryKey: ["adminTrips"] });
      queryClient.invalidateQueries({ queryKey: ["adminTripsTable"] });
      queryClient.invalidateQueries({ queryKey: ["adminTripStats"] });
      queryClient.invalidateQueries({ queryKey: ["pendingTrips"] });
      queryClient.removeQueries({ queryKey: ["adminTrip", tripId] });
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      queryClient.removeQueries({ queryKey: ["trip", tripId] });
      toast.success("Viaje eliminado");
    },
    onError: (error) => {
      console.error("Error deleting trip:", error);
      toast.error(
        error instanceof Error ? error.message : "No se pudo eliminar el viaje"
      );
    },
  });
}

export function useUpdateTripStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tripId, status }: { tripId: string; status: TripStatus }) => {
      const res = await fetch(`/api/admin/trips/${tripId}/status`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Error updating status");
      }
      return res.json();
    },
    onSuccess: (updatedTrip: Trip) => {
      // Admin
      queryClient.invalidateQueries({ queryKey: ["adminTrips"] });
      queryClient.invalidateQueries({ queryKey: ["adminTripsTable"] });
      queryClient.invalidateQueries({ queryKey: ["adminTripStats"] });
      queryClient.invalidateQueries({ queryKey: ["pendingTrips"] });
      queryClient.invalidateQueries({ queryKey: ["adminTrip", updatedTrip.id] });
      queryClient.setQueryData<Trip>(["adminTrip", updatedTrip.id], updatedTrip);
      // ✅ Usuario — ve el nuevo status en su card inmediatamente
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      queryClient.invalidateQueries({ queryKey: ["trip", updatedTrip.id] });
    },
    onError: (error) => console.error("Error updating trip status:", error),
  });
}

/** Descarga un blob como fichero. Compartido por los dos exports. */
async function downloadBlob(res: Response, fileName: string) {
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function useExportExcel() {
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/export", { credentials: "include" });
      if (!res.ok) throw new Error("Error exporting Excel");

      await downloadBlob(
        res,
        `gastos-completos-${new Date().toISOString().slice(0, 10)}.xlsx`,
      );
    },
    onError: (error) => {
      console.error("Error exporting Excel:", error);
      toast.error("No se pudo generar el Excel de gastos");
    },
  });
}

/**
 * 🆕 Excel de resumen de viajes: una fila por viaje, sin gastos. Estado, quién
 * lo pidió, cuándo se aprobó y si tiene billete y reserva.
 */
export function useExportTripsSummary() {
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/export/trips-summary", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Error exporting trips summary");

      await downloadBlob(
        res,
        `resumen-viajes-${new Date().toISOString().slice(0, 10)}.xlsx`,
      );
    },
    onError: (error) => {
      console.error("Error exporting trips summary:", error);
      toast.error("No se pudo generar el resumen de viajes");
    },
  });
}