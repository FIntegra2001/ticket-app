"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { TripDocument, TripDocumentType } from "@/types";

/* ===============================
   Documentos de un viaje (billete, reserva)
================================ */
export function useTripDocuments(tripId: string) {
  return useQuery<TripDocument[]>({
    queryKey: ["tripDocuments", tripId],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${tripId}/documents`, {
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Error al cargar los documentos");
      }
      return res.json();
    },
    enabled: !!tripId,
  });
}

/**
 * Sube un documento (solo ADMIN).
 *
 * El fichero va como FormData, sin `Content-Type` manual: hay que dejar que el
 * navegador ponga el boundary del multipart.
 */
export function useUploadTripDocument(tripId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      file,
      type,
    }: {
      file: File;
      type: TripDocumentType;
    }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", type);

      const res = await fetch(`/api/admin/trips/${tripId}/documents`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Error al subir el documento");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tripDocuments", tripId] });
      // Los badges "Billete ✓ / Reserva ✓" de las cards y tablas del admin
      queryClient.invalidateQueries({ queryKey: ["adminTrip", tripId] });
      queryClient.invalidateQueries({ queryKey: ["adminTrips"] });
      queryClient.invalidateQueries({ queryKey: ["adminTripsTable"] });
      toast.success("Documento subido");
    },
    onError: (error) => {
      console.error("Error uploading trip document:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo subir el documento",
      );
    },
  });
}

export function useDeleteTripDocument(tripId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (documentId: string) => {
      const res = await fetch(
        `/api/admin/trips/${tripId}/documents/${documentId}`,
        { method: "DELETE", credentials: "include" },
      );
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Error al eliminar el documento");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tripDocuments", tripId] });
      queryClient.invalidateQueries({ queryKey: ["adminTrip", tripId] });
      queryClient.invalidateQueries({ queryKey: ["adminTrips"] });
      queryClient.invalidateQueries({ queryKey: ["adminTripsTable"] });
      toast.success("Documento eliminado");
    },
    onError: (error) => {
      console.error("Error deleting trip document:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo eliminar el documento",
      );
    },
  });
}
