"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  useCreateOfficeExpense,
  useDeleteOfficeExpense,
  useExportOfficeExpenses,
  useOfficeExpenses,
} from "@/hooks/useOfficeExpenses";
import type { OfficeExpense } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";
import { MESES, officeExpenseTitle } from "@/lib/office-expenses";
import {
  Building2,
  FileSpreadsheet,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";

export default function OfficeExpensesPage() {
  const router = useRouter();
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useOfficeExpenses();
  const createParte = useCreateOfficeExpense();
  const deleteParte = useDeleteOfficeExpense();
  const exportExcel = useExportOfficeExpenses("mine");

  const now = new Date();
  const [isOpen, setIsOpen] = useState(false);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [notes, setNotes] = useState("");

  const partes = data?.pages.flatMap((p) => p.officeExpenses) ?? [];

  // Años seleccionables: el actual y los dos anteriores (para cerrar un mes que
  // se quedó atrás), más el siguiente por si se adelanta el cierre de diciembre.
  const years = [now.getFullYear() + 1, now.getFullYear(), now.getFullYear() - 1];

  const handleCreate = () => {
    createParte.mutate(
      { year, month, notes: notes || undefined },
      {
        onSuccess: ({ parte }) => {
          setIsOpen(false);
          setNotes("");
          // Tanto si se ha creado como si ya existía, se entra en él
          router.push(`/office-expenses/${parte.id}`);
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <Skeleton className="h-10 w-72 mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-8">
      <div className="mb-8 flex flex-col items-center gap-4 md:flex-row md:justify-between">
        <div className="text-center md:text-left">
          <h1 className="text-4xl font-bold text-gray-900">
            Mis gastos de oficina
          </h1>
          <p className="text-muted-foreground mt-1">
            Un parte por mes. No necesitan aprobación: creas el parte y cargas
            los tickets.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button onClick={() => setIsOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Nuevo parte
          </Button>

          {partes.length > 0 && (
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => exportExcel.mutate()}
              disabled={exportExcel.isPending}
            >
              {exportExcel.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Exportando...
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-4 h-4" />
                  Exportar
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {partes.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {partes.map((parte: OfficeExpense) => (
              <Card key={parte.id} className="relative w-full">
                <Link
                  href={`/office-expenses/${parte.id}`}
                  className="absolute inset-0 z-0"
                  aria-label={`Ver ${officeExpenseTitle(parte)}`}
                />
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg font-bold">
                      {officeExpenseTitle(parte)}
                    </CardTitle>
                    <Badge
                      variant={
                        parte.status === "CERRADO" ? "secondary" : "default"
                      }
                    >
                      {parte.status === "CERRADO" ? "Cerrado" : "Abierto"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {parte.expenses?.length ?? 0}{" "}
                    {(parte.expenses?.length ?? 0) === 1 ? "gasto" : "gastos"}
                  </p>
                  {parte.notes && (
                    <p className="truncate text-sm italic text-muted-foreground">
                      📝 {parte.notes}
                    </p>
                  )}
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg bg-muted p-3">
                    <span className="font-semibold">Total:</span>
                    <span className="text-2xl font-bold">
                      {formatCurrency(parte.totalAmount)}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      asChild
                    >
                      <Link href={`/office-expenses/${parte.id}`}>
                        <Plus className="mr-2 h-4 w-4" />
                        Gastos
                      </Link>
                    </Button>

                    {parte.status !== "CERRADO" && (
                      <ConfirmDeleteDialog
                        title="¿Eliminar este parte?"
                        description={
                          <>
                            Se eliminará{" "}
                            <strong>{officeExpenseTitle(parte)}</strong> con sus{" "}
                            {parte.expenses?.length ?? 0} gastos. Esta acción no
                            se puede deshacer.
                          </>
                        }
                        confirmLabel="Eliminar parte"
                        isPending={deleteParte.isPending}
                        onConfirm={() => deleteParte.mutate(parte.id)}
                        trigger={
                          <Button
                            variant="destructive"
                            size="sm"
                            className="relative z-10 px-3"
                            disabled={deleteParte.isPending}
                            aria-label="Eliminar parte"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        }
                      />
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {hasNextPage && (
            <div className="mt-10 flex justify-center">
              <Button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                size="lg"
                variant="outline"
              >
                {isFetchingNextPage ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Cargando...
                  </>
                ) : (
                  "Cargar más partes"
                )}
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Building2 className="mb-4 h-16 w-16 text-muted-foreground" />
          <h2 className="mb-2 text-xl font-semibold">
            No tienes partes de gastos de oficina
          </h2>
          <p className="mb-6 max-w-sm text-muted-foreground">
            Crea el parte del mes y ve añadiendo los tickets: taxi, material,
            comidas, mensajería…
          </p>
          <Button onClick={() => setIsOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Crear el parte de este mes
          </Button>
        </div>
      )}

      {/* Diálogo de creación */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo parte de gastos de oficina</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground">
              Hay un parte por mes. Si ya tienes el de ese mes, te llevo a él en
              lugar de crear otro.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Mes</Label>
                <Select
                  value={String(month)}
                  onValueChange={(v) => setMonth(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MESES.map((nombre, i) => (
                      <SelectItem key={nombre} value={String(i + 1)}>
                        {nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Año</Label>
                <Select
                  value={String(year)}
                  onValueChange={(v) => setYear(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Notas (opcional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreate} disabled={createParte.isPending}>
                {createParte.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creando...
                  </>
                ) : (
                  "Crear parte"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

