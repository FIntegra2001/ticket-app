"use client";

import { TripItinerary } from "@/components/trips/TripItinerary";
import { use, useState } from "react";
import { useAdminTrip, useUpdateTripStatus } from "@/hooks/useAdminTrips";
import {
  useCreateExpense,
  useDeleteExpense,
  useUpdateExpense,
} from "@/hooks/useExpenses";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Edit3, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Expense, TripStatus } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import ExpenseForm from "@/components/forms/ExpenseForm";
import {
  TRIP_STATUS_OPTIONS,
  TRIP_STATUS_LABEL,
  TRIP_STATUS_SHORT_LABEL,
  TRIP_STATUS_VARIANT,
} from "@/lib/trip-status";
import TripDocuments from "@/components/trips/TripDocuments";

export default function AdminTripExpenses({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = use(params);
  const { data: trip, isLoading } = useAdminTrip(tripId);
  const updateStatus = useUpdateTripStatus();

  const createExpense = useCreateExpense(tripId);
  const updateExpense = useUpdateExpense(tripId);
  const deleteExpense = useDeleteExpense(tripId);

  const [isExpenseOpen, setIsExpenseOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
 

  // Etiquetas y variantes vienen de lib/trip-status.ts (fuente única)
  const STATUS_OPTIONS = TRIP_STATUS_OPTIONS;

  // ✅ Construir lista de usuarios asignados desde assignedUsers
  const assignedUsers = trip?.assignedUsers ?? [];

  const handleCreateOrUpdate = (
    values: Parameters<typeof ExpenseForm>[0]["onSubmit"] extends (
      v: infer V,
    ) => void
      ? V
      : never,
  ) => {
    if (editingExpense) {
      updateExpense.mutate(
        {
          expenseId: editingExpense.id,
          data: values,
        },
        {
          onSuccess: () => {
            setIsExpenseOpen(false);
            setEditingExpense(null);
          },
        },
      );
    } else {
      createExpense.mutate(values, {
        onSuccess: () => setIsExpenseOpen(false),
      });
    }
  };


  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto p-8 space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="max-w-6xl mx-auto p-8 text-center py-12">
        <h2 className="text-2xl font-bold mb-4">Viaje no encontrado</h2>
        <Button asChild>
          <Link href="/admin">Volver al panel</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-8">
      {/* Volver */}
      <Button variant="outline" asChild className="mb-6">
        <Link href="/admin">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver al panel
        </Link>
      </Button>

      {/* Header del viaje */}
      <div className="bg-card border rounded-lg p-6 space-y-4 mb-8">
        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold">{trip.city}</h1>
            {trip.project && (
              <p className="text-muted-foreground">Proyecto: {trip.project}</p>
            )}
            <TripItinerary trip={trip} />
          </div>

          {/* Cambiar status */}
          <div className="flex items-center gap-3">
            <Badge variant={TRIP_STATUS_VARIANT[trip.status]} className="text-sm">
              {TRIP_STATUS_LABEL[trip.status]}
            </Badge>
            <Select
              value={trip.status}
              onValueChange={(status) =>
                updateStatus.mutate({
                  tripId: trip.id,
                  status: status as TripStatus,
                })
              }
              disabled={updateStatus.isPending}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {TRIP_STATUS_SHORT_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Info del viaje */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
          {/* ✅ Usuarios asignados */}
          <div>
            <p className="text-sm text-muted-foreground mb-1">
              {assignedUsers.length === 1
                ? "Usuario asignado"
                : "Usuarios asignados"}
            </p>
            {assignedUsers.length > 0 ? (
              <div className="space-y-1">
                {assignedUsers.map((a) => (
                  <div key={a.userId}>
                    <p className="font-medium">
                      {a.user?.name ?? "Sin nombre"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {a.user?.email}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Sin asignar</p>
            )}
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-1">Fechas</p>
            <p className="font-medium">
              {formatDate(trip.startDate)} — {formatDate(trip.endDate)}
            </p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-1">Total</p>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(trip.totalAmount)}
            </p>
          </div>
        </div>

        {trip.notes && (
          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground">Notas</p>
            <p className="text-sm">{trip.notes}</p>
          </div>
        )}
      </div>

      {/* 🆕 Billete y reserva: el admin los sube aquí y el usuario los ve en su
          propia vista del viaje, sin pedírselos por correo. */}
      <TripDocuments tripId={tripId} isAdmin />

      {/* Sección de gastos */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">
            Gastos ({trip.expenses?.length ?? 0})
          </h2>

          {/* ✅ Admin puede añadir gasto inicial (billete, etc.) */}
          <Button
            onClick={() => {
              setEditingExpense(null);
              setIsExpenseOpen(true);
            }}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            Añadir Gasto
          </Button>
        </div>

        {trip.expenses && trip.expenses.length > 0 ? (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>CIF/NIF</TableHead>
                  <TableHead>Método Pago</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-center">Adjunto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trip.expenses.map((expense: Expense) => (
                  <TableRow key={expense.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(expense.date)}
                    </TableCell>
                    <TableCell>
                      {/* ✅ Billete creado por admin se marca visualmente */}
                      <Badge
                        variant={
                          expense.createdByAdminId ? "default" : "secondary"
                        }
                      >
                        {expense.category ?? "-"}
                      </Badge>
                    </TableCell>
                    <TableCell>{expense.vendor ?? "-"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {expense.invoiceNumber ?? "-"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {expense.paymentMethod ?? "-"}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(expense.amount)}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-sm">
                      {expense.description ?? "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      {expense.receiptUrl ? (
                        <div className="flex gap-2 justify-center">
                          <a
                            href={expense.receiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline text-sm"
                          >
                            📄 Ver
                          </a>
                          <a
                            href={expense.receiptUrl}
                            download
                            target="_blank"
                            className="text-green-600 hover:underline text-sm"
                          >
                            ⬇️
                          </a>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    {/* ✅ Botones editar y borrar */}
                    <TableCell className="text-center">
                      <div className="flex gap-2 justify-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingExpense(expense);
                            setIsExpenseOpen(true);
                          }}
                        >
                          <Edit3 className="w-4 h-4" />
                        </Button>
                        <ConfirmDeleteDialog
                          title="¿Eliminar este gasto?"
                          description={
                            <>
                              Vas a eliminar el gasto de{" "}
                              <strong>{formatCurrency(expense.amount)}</strong>
                              {expense.vendor ? (
                                <>
                                  {" "}
                                  en <strong>{expense.vendor}</strong>
                                </>
                              ) : null}{" "}
                              del {formatDate(expense.date)}. El total del viaje
                              se recalculará. Esta acción no se puede deshacer.
                            </>
                          }
                          confirmLabel="Eliminar gasto"
                          isPending={deleteExpense.isPending}
                          onConfirm={() => deleteExpense.mutate(expense.id)}
                          trigger={
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={deleteExpense.isPending}
                              aria-label="Eliminar gasto"
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          }
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-16 border rounded-lg text-muted-foreground">
            <p className="mb-4">No hay gastos registrados para este viaje</p>
            <Button variant="outline" onClick={() => setIsExpenseOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Añadir primer gasto
            </Button>
          </div>
        )}
      </div>

           {/* Dialog para añadir/editar gasto */}
      <Dialog
        open={isExpenseOpen}
        onOpenChange={(open) => {
          setIsExpenseOpen(open);
          if (!open) setEditingExpense(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingExpense ? "Editar Gasto" : "Añadir Gasto"}
            </DialogTitle>
          </DialogHeader>
          <ExpenseForm
            tripId={tripId}
            stages={trip?.stages}
            initialData={editingExpense}
            onSubmit={handleCreateOrUpdate}
            onCancel={() => {
              setIsExpenseOpen(false);
              setEditingExpense(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
