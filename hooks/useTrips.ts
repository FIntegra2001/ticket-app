"use client";

import { useUserContext } from "@/context/userContext";
import { RequestTripDto, Trip, PaginatedResponse } from "@/types";
import {
  useInfiniteQuery,
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";

/* ===============================
   Obtener viajes con paginación (INFINITE SCROLL)
================================ */
export function useTrips() {
  const { user } = useUserContext();

  return useInfiniteQuery<PaginatedResponse<Trip>>({
    queryKey: ["trips", user?.id],
    queryFn: async ({ pageParam = 1 }) => {
      if (!user?.id) throw new Error("No user");

      const res = await fetch(`/api/trips?page=${pageParam}&limit=9`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Error fetching trips");
      }

      return res.json();
    },
    getNextPageParam: (lastPage) => {
      return lastPage.pagination.hasMore
        ? lastPage.pagination.page + 1
        : undefined;
    },
    initialPageParam: 1,
    enabled: !!user?.id,
  });
}

/* ===============================
   Obtener un viaje
================================ */
export function useTrip(tripId: string) {
  const { user } = useUserContext();

  return useQuery<Trip>({
    queryKey: ["trip", tripId],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${tripId}`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Error fetching trip");
      }

      return res.json();
    },
    enabled: !!tripId && !!user?.id,
  });
}

/* ===============================
   Crear viaje
================================ */
// export function useCreateTrip() {
//   const queryClient = useQueryClient();
//   const { user } = useUserContext();

//   return useMutation({
//     mutationFn: async (data: CreateTripDto) => {
//       if (!user?.id) throw new Error("No user");

//       const res = await fetch("/api/trips", {
//         method: "POST",
//         credentials: "include",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(data),
//       });

//       if (!res.ok) {
//         const error = await res.json();
//         throw new Error(error.error || "Error creating trip");
//       }

//       return res.json();
//     },
//     onSuccess: () => {
//       // Invalidar para refrescar la lista
//       queryClient.invalidateQueries({ queryKey: ["trips", user!.id] });
//     },
//     onError: (error) => {
//       console.error("Error creating trip:", error);
//     },
//   });
// }

/* ===============================
   Editar la solicitud (solo mientras esté PENDIENTE — lo valida el backend)
================================ */
export function useUpdateTripRequest() {
  const queryClient = useQueryClient();
  const { user } = useUserContext();

  return useMutation({
    mutationFn: async ({
      tripId,
      data,
    }: {
      tripId: string;
      data: Partial<RequestTripDto>;
    }) => {
      if (!user?.id) throw new Error("No user");

      const res = await fetch(`/api/trips/${tripId}`, {
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
      queryClient.invalidateQueries({ queryKey: ["trips", user!.id] });
      queryClient.invalidateQueries({ queryKey: ["trip", updatedTrip.id] });
      queryClient.setQueryData<Trip>(["trip", updatedTrip.id], updatedTrip);
      // Las listas del admin también cambian: la solicitud sigue en su panel
      queryClient.invalidateQueries({ queryKey: ["adminTrips"] });
      queryClient.invalidateQueries({ queryKey: ["adminTripsTable"] });
      queryClient.invalidateQueries({ queryKey: ["pendingTrips"] });
      toast.success("Solicitud actualizada");
    },
    onError: (error) => {
      console.error("Error updating trip request:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo actualizar la solicitud"
      );
    },
  });
}

/* ===============================
   🆕 Solicitar un viaje (USER)
   POST /api/trips → el backend lo crea en PENDIENTE y autoasignado.
================================ */
export function useRequestTrip() {
  const queryClient = useQueryClient();
  const { user } = useUserContext();

  return useMutation({
    mutationFn: async (data: RequestTripDto) => {
      const res = await fetch("/api/trips", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Error al solicitar el viaje");
      }

      return res.json();
    },
    onSuccess: () => {
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ["trips", user.id] });
        queryClient.invalidateQueries({ queryKey: ["tripStats", user.id] });
      }
      // El admin tiene que ver la solicitud nueva en su panel
      queryClient.invalidateQueries({ queryKey: ["adminTrips"] });
      queryClient.invalidateQueries({ queryKey: ["adminTripsTable"] });
      queryClient.invalidateQueries({ queryKey: ["adminTripStats"] });
      queryClient.invalidateQueries({ queryKey: ["pendingTrips"] });
      toast.success(
        "Solicitud enviada. Administración la revisará y te avisará al aprobarla."
      );
    },
    onError: (error) => {
      console.error("Error requesting trip:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo enviar la solicitud"
      );
    },
  });
}

/* ===============================
   Eliminar viaje
================================ */
export function useDeleteTrip() {
  const queryClient = useQueryClient();
  const { user } = useUserContext();

  return useMutation({
    mutationFn: async (tripId: string) => {
      if (!user?.id) throw new Error("No user");

      const res = await fetch(`/api/trips/${tripId}`, {
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
      queryClient.invalidateQueries({ queryKey: ["trips", user!.id] });
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

/* ===============================
   Obtener TODAS las trips para stats (sin paginación)
================================ */
export function useTripStats() {
  const { user } = useUserContext();

  return useQuery<Trip[]>({
    queryKey: ["tripStats", user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error("No user");

      const res = await fetch("/api/trips/stats", {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Error fetching trip stats");
      }

      return res.json();
    },
    enabled: !!user?.id,
  });
}

/* ===============================
   ✅ NUEVO: Exportar Excel del usuario (solo sus viajes)
================================ */
export function useExportUserExcel() {
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/trips/export", {
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Error exporting Excel");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mis-gastos-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    onError: (error) => {
      console.error("Error exporting user Excel:", error);
    },
  });
}