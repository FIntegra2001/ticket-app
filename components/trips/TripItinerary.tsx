import { MapPin } from "lucide-react";
import type { Trip } from "@/types";
import { formatDate } from "@/lib/utils";
import { nightsBetween, stageCityName } from "@/lib/trip-stages";

/** Fase 1: itinerario de un viaje (solo se pinta si tiene 2+ destinos). */
export function TripItinerary({ trip }: { trip: Trip }) {
  const stages = [...(trip.stages ?? [])].sort((a, b) => a.position - b.position);
  if (stages.length < 2) return null;

  return (
    <div className="border rounded-lg p-3 bg-muted/30 space-y-1">
      <p className="text-sm font-medium">
        Viaje combinado{trip.region ? ` · ${trip.region}` : ""}
      </p>
      <ol className="space-y-1">
        {stages.map((s) => {
          const nights = nightsBetween(s.arrivalDate, s.departureDate);
          const count = trip.expenses?.filter((e) => e.stageId === s.id).length ?? 0;
          return (
            <li key={s.id} className="text-sm flex items-center gap-2">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="font-medium">
                {s.position}. {stageCityName(s)}
              </span>
              <span className="text-muted-foreground">
                {formatDate(s.arrivalDate)} – {formatDate(s.departureDate)} · {nights}{" "}
                {nights === 1 ? "noche" : "noches"} · {count} gasto{count === 1 ? "" : "s"}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
