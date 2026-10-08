"use client";

import { useState } from "react";
import {
  useTrips,
  useExportUserExcel,
  useRequestTrip,
  useUpdateTripRequest,
} from "@/hooks/useTrips";
import type { CreateTripDto, Trip } from "@/types";
import TripCard from "@/components/trips/TripCard";
import TripForm from "@/components/forms/TripForm";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Luggage, FileSpreadsheet, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function TripsPage() {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useTrips();

  const exportExcel = useExportUserExcel();
  const requestTrip = useRequestTrip();
  const updateRequest = useUpdateTripRequest();

  // 🆕 Diálogo de solicitud. `editingTrip` distingue crear de editar.
  const [isOpen, setIsOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);

  const allTrips = data?.pages.flatMap((page) => page.trips) ?? [];
  const pendingCount = allTrips.filter((t) => t.status === "PENDIENTE").length;

  const closeDialog = () => {
    setIsOpen(false);
    setEditingTrip(null);
  };

  // TripForm entrega un CreateTripDto; en modo "request" el nº de factura y los
  // asignados vienen vacíos y el backend los ignora (usa requestTripSchema).
  const handleSubmit = (formData: CreateTripDto) => {
    const payload = {
      stages: formData.stages,
      project: formData.project,
      notes: formData.notes,
    };

    if (editingTrip) {
      updateRequest.mutate(
        { tripId: editingTrip.id, data: payload },
        { onSuccess: closeDialog },
      );
    } else {
      requestTrip.mutate(payload, { onSuccess: closeDialog });
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <div className="mb-8">
          <Skeleton className="h-10 w-64 mb-2" />
          <Skeleton className="h-5 w-48" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-80 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-8">
      <div className="mb-8">
        <div className="flex flex-col items-center gap-4 md:flex-row md:items-center md:justify-between">
          <div className="text-center md:text-left">
            <h1 className="text-4xl font-bold text-gray-900">Mis Viajes</h1>
            <p className="text-muted-foreground mt-1">
              {pendingCount > 0
                ? `Tienes ${pendingCount} ${
                    pendingCount === 1
                      ? "solicitud pendiente de aprobación"
                      : "solicitudes pendientes de aprobación"
                  }`
                : "Tus viajes aprobados y tus solicitudes"}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto mb-2">
            {/* 🆕 Solicitar viaje */}
            <Button
              onClick={() => {
                setEditingTrip(null);
                setIsOpen(true);
              }}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Solicitar viaje
            </Button>

            {/* ✅ Botón exportar Excel — solo visible si hay trips */}
            {allTrips.length > 0 && (
              <Button
                onClick={() => exportExcel.mutate()}
                disabled={exportExcel.isPending}
                variant="outline"
                className="gap-2"
              >
                {exportExcel.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Exportando...
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="w-4 h-4" />
                    Exportar mis gastos
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {allTrips.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {allTrips.map((trip: Trip) => (
              <TripCard
                key={trip.id}
                tripId={trip.id}
                readOnly
                onEditRequest={(t) => {
                  setEditingTrip(t);
                  setIsOpen(true);
                }}
              />
            ))}
          </div>

          {hasNextPage && (
            <div className="flex justify-center mt-10">
              <Button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                size="lg"
                variant="outline"
              >
                {isFetchingNextPage ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Cargando...
                  </>
                ) : (
                  "Cargar más viajes"
                )}
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Luggage className="w-16 h-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">No tienes viajes</h2>
          <p className="text-muted-foreground max-w-sm mb-6">
            Solicita un viaje y administración lo revisará. Cuando lo apruebe
            podrás empezar a cargar gastos.
          </p>
          <Button onClick={() => setIsOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Solicitar mi primer viaje
          </Button>
        </div>
      )}

      {/* 🆕 Diálogo de solicitud (crear o editar mientras esté PENDIENTE) */}
      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) setEditingTrip(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTrip ? "Editar solicitud" : "Solicitar viaje"}
            </DialogTitle>
          </DialogHeader>
          <TripForm
            mode="request"
            initialData={editingTrip}
            onSubmit={handleSubmit}
            onCancel={closeDialog}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
