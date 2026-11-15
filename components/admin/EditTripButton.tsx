"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import TripForm from "@/components/forms/TripForm";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useUpdateTrip } from "@/hooks/useAdminTrips";
import type { CreateTripDto, Trip } from "@/types";

/**
 * Editar un viaje (ADMIN) desde cualquier sitio: personas asignadas, destinos,
 * proyectos, notas y nº de liquidación, en cualquier estado del viaje.
 */
export function EditTripButton({ trip, compact = false }: { trip: Trip; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const updateTrip = useUpdateTrip();

  const handleSubmit = (data: CreateTripDto) =>
    updateTrip.mutate({ tripId: trip.id, data }, { onSuccess: () => setOpen(false) });

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        aria-label="Editar viaje"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
      >
        <Pencil className="w-4 h-4" />
        {!compact && <span className="ml-2">Editar viaje</span>}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-2xl max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle>Editar viaje</DialogTitle>
          </DialogHeader>
          {open && <TripForm initialData={trip} onSubmit={handleSubmit} onCancel={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
