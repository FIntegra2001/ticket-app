"use client";

import { Suspense, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import PendingTripRequests from "@/components/admin/PendingTripRequests";
import { ExportDialog } from "@/components/admin/ExportDialog";
import { isTripTab, TRIP_TABS, type TripTab } from "@/lib/trip-tabs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  useAdminTrips,
  useCreateTrip,
  useUpdateTrip,
  useDeleteTrip,
} from "@/hooks/useAdminTrips";
import type { CreateTripDto, Trip } from "@/types";
import TripCard from "@/components/trips/TripCard";
import TripForm from "@/components/forms/TripForm";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Plus, Map } from "lucide-react";

// useSearchParams exige un límite de Suspense en Next 16
export default function AdminAllTripsPage() {
  return (
    <Suspense>
      <AdminAllTrips />
    </Suspense>
  );
}

function AdminAllTrips() {
  // Fase 3: pestaña activa en la URL (?tab=), para volver a ella desde el detalle
  const router = useRouter();
  const pathname = usePathname();
  const tabParam = useSearchParams().get("tab");
  const tab: TripTab = isTripTab(tabParam) ? tabParam : "proximos";
  const setTab = (t: TripTab) => router.replace(`${pathname}?tab=${t}`, { scroll: false });

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useAdminTrips(tab);
  const counts = data?.pages[0]?.counts;

  const createTrip = useCreateTrip();
  const updateTrip = useUpdateTrip();
  const deleteTrip = useDeleteTrip();

  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // ✅ Flatten todas las páginas
  const allTrips = data?.pages.flatMap((page) => page.trips) ?? [];

  const handleSubmit = (formData: CreateTripDto) => {
    if (editingTrip) {
      updateTrip.mutate({
        tripId: editingTrip.id,
        data: formData,
      });
    } else {
      createTrip.mutate(formData);
    }
    setIsOpen(false);
    setEditingTrip(null);
  };

  const handleEdit = (trip: Trip) => {
    setEditingTrip(trip);
    setIsOpen(true);
  };

  const handleDelete = (tripId: string) => {
    deleteTrip.mutate(tripId);
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <div className="flex justify-between items-center mb-8">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-11 w-40" />
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
      <div className="flex flex-col items-center gap-4 md:flex-row md:items-center md:justify-between">
        <div className="text-center md:text-left">
          <h1 className="text-4xl font-bold text-gray-900">Viajes</h1>
          <p className="text-muted-foreground mt-1">
            Solicitudes por aprobar, próximos viajes y realizados
          </p>
        </div>

        {/* ✅ Dialog para crear/editar viaje — solo visible para ADMIN */}
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto mb-4">
          <ExportDialog />
          <Dialog
            open={isOpen}
            onOpenChange={(open) => {
              setIsOpen(open);
              if (!open) setEditingTrip(null);
            }}
          >
            <DialogTrigger asChild>
              <Button size="lg" className="gap-2">
                <Plus className="w-4 h-4" />
                Nuevo Viaje
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingTrip ? "Editar Viaje" : "Nuevo Viaje"}
                </DialogTitle>
              </DialogHeader>
              <TripForm
                initialData={editingTrip}
                onSubmit={handleSubmit}
                onCancel={() => {
                  setIsOpen(false);
                  setEditingTrip(null);
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Fase 3: pestañas */}
      <div className="flex gap-1 border-b mb-6 overflow-x-auto">
        {TRIP_TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`px-4 py-2 -mb-px border-b-2 text-sm font-medium whitespace-nowrap ${
              tab === t.value
                ? "border-indigo-600 text-indigo-700"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {t.label}
            {counts?.[t.value] !== undefined && (
              <span
                className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                  t.value === "solicitudes" && counts[t.value] > 0
                    ? "bg-amber-500 text-white"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {counts[t.value]}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "solicitudes" ? (
        allTrips.length > 0 ? (
          <PendingTripRequests />
        ) : (
          <p className="text-muted-foreground py-12 text-center">
            No hay solicitudes pendientes de aprobar.
          </p>
        )
      ) : allTrips.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {allTrips.map((trip: Trip) => (
              <TripCard
                key={trip.id}
                tripId={trip.id}
                // ✅ Admin puede editar y eliminar
                onEdit={handleEdit}
                onDelete={handleDelete}
                isDeleting={deleteTrip.isPending}
                isAdmin
              />
            ))}
          </div>

          {/* Cargar más */}
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
          <Map className="w-16 h-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">
            {tab === "proximos" ? "No hay viajes próximos" : "No hay viajes realizados"}
          </h2>
          <p className="text-muted-foreground max-w-sm mb-6">
            Crea un viaje y asígnalo a un usuario.
          </p>
          <Button onClick={() => setIsOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Nuevo viaje
          </Button>
        </div>
      )}
    </div>
  );
}
