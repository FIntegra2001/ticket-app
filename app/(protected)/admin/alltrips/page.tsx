"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Map, Plus, Search, X } from "lucide-react";
import { ExportDialog } from "@/components/admin/ExportDialog";
import { AdminTripRow } from "@/components/admin/AdminTripRow";
import TripForm from "@/components/forms/TripForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAdminTrips, useCreateTrip, useUpdateTrip } from "@/hooks/useAdminTrips";
import { useCities } from "@/hooks/useCities";
import { isTripTab, TRIP_TABS, type TripTab } from "@/lib/trip-tabs";
import type { CreateTripDto, Trip } from "@/types";

// useSearchParams exige un límite de Suspense en Next 16
export default function AdminAllTripsPage() {
  return (
    <Suspense>
      <AdminAllTrips />
    </Suspense>
  );
}

const ALL = "__all";

function AdminAllTrips() {
  // Pestaña y filtros viven en la URL: al volver del detalle se conservan
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tabParam = params.get("tab");
  const tab: TripTab = isTripTab(tabParam) ? tabParam : "proximos";
  const q = params.get("q") ?? "";
  const cityId = params.get("cityId") ?? "";
  const month = params.get("month") ?? "";

  const setParams = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  // Buscador con espera de 300 ms para no consultar en cada tecla
  const [search, setSearch] = useState(q);
  useEffect(() => {
    const t = setTimeout(() => search !== q && setParams({ q: search }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const { data: cities = [] } = useCities(true);
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useAdminTrips(tab, {
    q,
    cityId,
    month,
  });
  const counts = data?.pages[0]?.counts;
  const trips = data?.pages.flatMap((p) => p.trips) ?? [];
  const hasFilters = !!(q || cityId || month);

  const createTrip = useCreateTrip();
  const updateTrip = useUpdateTrip();
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const handleSubmit = (formData: CreateTripDto) => {
    if (editingTrip) updateTrip.mutate({ tripId: editingTrip.id, data: formData });
    else createTrip.mutate(formData);
    setIsOpen(false);
    setEditingTrip(null);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Viajes</h1>
          <p className="text-muted-foreground mt-1">Solicitudes por aprobar, próximos viajes y realizados</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
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
                Nuevo viaje
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingTrip ? "Editar viaje" : "Nuevo viaje"}</DialogTitle>
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

      {/* Pestañas */}
      <div className="flex gap-1 border-b mb-4 overflow-x-auto">
        {TRIP_TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setParams({ tab: t.value })}
            className={`px-4 py-2 -mb-px border-b-2 text-sm font-medium whitespace-nowrap ${
              tab === t.value ? "border-indigo-600 text-indigo-700" : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {t.label}
            {counts?.[t.value] !== undefined && (
              <span
                className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                  t.value === "solicitudes" && counts[t.value] > 0 ? "bg-amber-500 text-white" : "bg-gray-100 text-gray-600"
                }`}
              >
                {counts[t.value]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_200px_170px_auto] mb-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar nº de liquidación, persona o ciudad"
            className="pl-9"
          />
        </div>
        <Select value={cityId || ALL} onValueChange={(v) => setParams({ cityId: v === ALL ? "" : v })}>
          <SelectTrigger>
            <SelectValue placeholder="Ciudad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas las ciudades</SelectItem>
            {cities.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="month" value={month} onChange={(e) => setParams({ month: e.target.value })} aria-label="Mes de inicio" />
        {hasFilters && (
          <Button
            variant="ghost"
            onClick={() => {
              setSearch("");
              setParams({ q: "", cityId: "", month: "" });
            }}
          >
            <X className="w-4 h-4 mr-1" /> Limpiar
          </Button>
        )}
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : trips.length > 0 ? (
        <>
          <div className="bg-white border rounded-lg divide-y">
            {trips.map((trip) => (
              <AdminTripRow
                key={trip.id}
                trip={trip}
                tab={tab}
                onEdit={(t) => {
                  setEditingTrip(t);
                  setIsOpen(true);
                }}
              />
            ))}
          </div>
          {hasNextPage && (
            <div className="flex justify-center mt-6">
              <Button onClick={() => fetchNextPage()} disabled={isFetchingNextPage} variant="outline">
                {isFetchingNextPage ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Cargar más
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Map className="w-12 h-12 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">
            {hasFilters ? "Ningún viaje coincide con los filtros." : `No hay viajes en ${TRIP_TABS.find((t) => t.value === tab)?.label}.`}
          </p>
        </div>
      )}
    </div>
  );
}
