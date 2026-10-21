"use client";

import * as React from "react";
import { Check, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUpdateTrip } from "@/hooks/useAdminTrips";
import type { Trip } from "@/types";

/** Fase 3: nº de factura (liquidación) visible y editable en el detalle del viaje. */
export function InvoiceField({ trip }: { trip: Trip }) {
  const updateTrip = useUpdateTrip();
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState(trip.numberInvoice ?? "");

  const save = () =>
    updateTrip.mutate(
      { tripId: trip.id, data: { numberInvoice: value.trim() } },
      { onSuccess: () => setEditing(false) },
    );

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Nº factura:</span>
        <Input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          className="h-8 w-32"
        />
        <Button size="icon" variant="ghost" onClick={save} disabled={updateTrip.isPending} aria-label="Guardar">
          <Check className="w-4 h-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => {
            setValue(trip.numberInvoice ?? "");
            setEditing(false);
          }}
          aria-label="Cancelar"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className={`flex items-center gap-2 text-sm hover:underline ${
        trip.numberInvoice ? "text-gray-800" : "text-amber-600"
      }`}
    >
      🧾 {trip.numberInvoice ? `Nº factura: ${trip.numberInvoice}` : "Sin nº de factura — añadir"}
      <Pencil className="w-3 h-3" />
    </button>
  );
}
