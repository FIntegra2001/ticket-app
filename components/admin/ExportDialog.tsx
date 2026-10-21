"use client";

import * as React from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useExportExcel, useExportTripsSummary } from "@/hooks/useAdminTrips";
import { TRIP_TABS } from "@/lib/trip-tabs";

/**
 * Fase 3: exportaciones con filtro. Antes cada botón sacaba todo lo guardado.
 *  · Gastos (formato contable, columnas fijas): por mes.
 *  · Resumen de viajes (reporte semanal): por pestaña (Próximos por defecto) y mes.
 */
export function ExportDialog() {
  const exportExcel = useExportExcel();
  const exportSummary = useExportTripsSummary();
  const [kind, setKind] = React.useState<"resumen" | "gastos">("resumen");
  const [tab, setTab] = React.useState<string>("proximos");
  const [month, setMonth] = React.useState<string>(new Date().toISOString().slice(0, 7));
  const [allMonths, setAllMonths] = React.useState(true);

  const busy = exportExcel.isPending || exportSummary.isPending;
  const monthFilter = allMonths ? undefined : month;

  const run = () =>
    kind === "gastos"
      ? exportExcel.mutate({ month: monthFilter })
      : exportSummary.mutate({ tab: tab === "todos" ? undefined : tab, month: monthFilter });

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="lg" variant="outline" className="gap-2">
          <FileSpreadsheet className="w-4 h-4" />
          Exportar Excel
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Exportar a Excel</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={kind === "resumen" ? "default" : "outline"}
              onClick={() => {
                setKind("resumen");
                setAllMonths(true);
              }}
            >
              Resumen de viajes
            </Button>
            <Button
              variant={kind === "gastos" ? "default" : "outline"}
              onClick={() => {
                setKind("gastos");
                setAllMonths(false);
              }}
            >
              Gastos
            </Button>
          </div>

          {kind === "resumen" && (
            <div className="space-y-1">
              <Label>Viajes</Label>
              <div className="flex flex-wrap gap-2">
                {[...TRIP_TABS, { value: "todos", label: "Todos" }].map((t) => (
                  <Button
                    key={t.value}
                    size="sm"
                    variant={tab === t.value ? "default" : "outline"}
                    onClick={() => setTab(t.value)}
                  >
                    {t.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="month">
              {kind === "gastos" ? "Mes de los gastos" : "Mes de inicio del viaje"}
            </Label>
            <div className="flex items-center gap-3">
              <Input
                id="month"
                type="month"
                value={month}
                disabled={allMonths}
                onChange={(e) => setMonth(e.target.value)}
                className="max-w-44"
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={allMonths}
                  onChange={(e) => setAllMonths(e.target.checked)}
                />
                Todos los meses
              </label>
            </div>
          </div>

          <Button className="w-full" disabled={busy} onClick={run}>
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Descargar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
