// app/trips/[tripId]/expenses/page.tsx
"use client";

import { useParams } from "next/navigation";
import { useTrip } from "@/hooks/useTrips";
import {
  useCreateExpense,
  useUpdateExpense,
  useDeleteExpense,
  useExpenses,
} from "@/hooks/useExpenses";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { Expense } from "@/types";
import { useState } from "react";
import ExpenseForm from "@/components/forms/ExpenseForm";
import { useRouter } from "next/navigation";
import { SkeletonExpenses } from "@/components/SkeletonExpenses";
import { acceptsExpenses, TRIP_STATUS_LABEL } from "@/lib/trip-status";
import { Lock } from "lucide-react";
import TripDocuments from "@/components/trips/TripDocuments";

export default function TripExpensesPage() {
  const params = useParams<{ tripId: string }>();
  const tripId = params.tripId;
  const router = useRouter();

  const { data: trip } = useTrip(tripId);
  const { data: expenses, isLoading } = useExpenses(tripId);
  const createExpense = useCreateExpense(tripId);
  const updateExpense = useUpdateExpense(tripId);
  const deleteExpense = useDeleteExpense(tripId);

  const [editing, setEditing] = useState<Expense | null>(null);
  const [showForm, setShowForm] = useState(false);

  if (isLoading) return <SkeletonExpenses />;

  // 🆕 La card ya no enlaza aquí si el viaje no está aprobado, pero la URL es
  // adivinable: sin esta guarda el usuario vería el formulario y solo se
  // enteraría al recibir el 403 del servidor al guardar.
  if (trip && !acceptsExpenses(trip.status)) {
    const isPending = trip.status === "PENDIENTE";
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <Button
          variant="ghost"
          className="px-0"
          onClick={() => router.push("/trips")}
        >
          ← Volver
        </Button>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-muted-foreground" />
              {isPending
                ? "Solicitud pendiente de aprobación"
                : "Viaje rechazado"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              El viaje a <strong>{trip.city}</strong> está en estado{" "}
              <strong>{TRIP_STATUS_LABEL[trip.status]}</strong>, así que todavía
              no admite gastos.
            </p>
            <p>
              {isPending
                ? "En cuanto administración lo apruebe podrás cargar tus tickets aquí."
                : "Si crees que es un error, habla con administración."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <Button
        variant="ghost"
        className="px-0"
        onClick={() => router.push("/trips")}
      >
        ← Volver
      </Button>
      <div className="flex flex-col items-center gap-4 md:flex-row md:items-center md:justify-between">
        <div className="text-center md:text-left">
          <h1 className="text-2xl font-bold">Gastos de {trip?.city}</h1>
          <p className="text-sm text-muted-foreground">
            Del {trip && formatDate(trip.startDate)} al{" "}
            {trip && formatDate(trip.endDate)}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto mb-2">
          <Button
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
          >
            Nuevo gasto
          </Button>
        </div>
      </div>

      {/* 🆕 Billete y reserva, antes de los gastos */}
      <TripDocuments tripId={tripId} />

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editing ? "Editar gasto" : "Nuevo gasto"}</CardTitle>
          </CardHeader>
          <CardContent>
            <ExpenseForm
              tripId={tripId}
              initialData={editing || undefined}
              onSubmit={(values) => {
                if (editing) {
                  updateExpense.mutate(
                    { expenseId: editing.id, data: values },
                    {
                      onSuccess: () => {
                        setEditing(null);
                        setShowForm(false);
                      },
                    },
                  );
                } else {
                  createExpense.mutate(values, {
                    onSuccess: () => {
                      setShowForm(false);
                    },
                  });
                }
              }}
              onCancel={() => {
                setEditing(null);
                setShowForm(false);
              }}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Listado de gastos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {expenses && expenses.length > 0 ? (
            expenses.map((exp: Expense) => (
              <div
                key={exp.id}
                className="flex flex-col sm:flex-row sm:justify-between sm:items-center border rounded p-2 gap-3"
              >
                <div className="flex-1">
                  <p className="font-medium">
                    {exp.vendor || exp.category || "Sin categoría"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(exp.date)} • {exp.description}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <span className="font-semibold text-center sm:text-right">
                    {formatCurrency(exp.amount)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditing(exp);
                      setShowForm(true);
                    }}
                    className="w-full sm:w-auto"
                  >
                    Editar
                  </Button>
                  <ConfirmDeleteDialog
                    title="¿Eliminar este gasto?"
                    description={
                      <>
                        Vas a eliminar el gasto de{" "}
                        <strong>{formatCurrency(exp.amount)}</strong>
                        {exp.vendor ? (
                          <>
                            {" "}
                            en <strong>{exp.vendor}</strong>
                          </>
                        ) : null}{" "}
                        del {formatDate(exp.date)}. El total del viaje se
                        recalculará. Esta acción no se puede deshacer.
                      </>
                    }
                    confirmLabel="Eliminar gasto"
                    isPending={deleteExpense.isPending}
                    onConfirm={() => deleteExpense.mutate(exp.id)}
                    trigger={
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={deleteExpense.isPending}
                        className="w-full sm:w-auto"
                      >
                        Borrar
                      </Button>
                    }
                  />
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Sin gastos aún.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
