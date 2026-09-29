"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useCreateOfficeExpenseItem,
  useDeleteOfficeExpenseItem,
  useOfficeExpense,
  useOfficeExpenseItems,
  useUpdateOfficeExpense,
  useUpdateOfficeExpenseItem,
} from "@/hooks/useOfficeExpenses";
import type { Expense } from "@/types";
import ExpenseForm from "@/components/forms/ExpenseForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { SkeletonExpenses } from "@/components/SkeletonExpenses";
import { formatCurrency, formatDate } from "@/lib/utils";
import { officeExpenseTitle } from "@/lib/office-expenses";
import { EXPENSE_CATEGORIES } from "@/lib/expense-categories";
import { Lock, LockOpen } from "lucide-react";

/** Label de la categoría tal y como se muestra en el select de oficina. */
function categoryLabel(value?: string | null): string {
  if (!value) return "Sin categoría";
  return EXPENSE_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

export default function OfficeExpenseDetailPage({
  params,
}: {
  params: Promise<{ officeExpenseId: string }>;
}) {
  const { officeExpenseId } = use(params);
  const router = useRouter();

  const { data: parte, isLoading } = useOfficeExpense(officeExpenseId);
  const { data: expenses } = useOfficeExpenseItems(officeExpenseId);
  const createExpense = useCreateOfficeExpenseItem(officeExpenseId);
  const updateExpense = useUpdateOfficeExpenseItem(officeExpenseId);
  const deleteExpense = useDeleteOfficeExpenseItem(officeExpenseId);
  const updateParte = useUpdateOfficeExpense();

  const [editing, setEditing] = useState<Expense | null>(null);
  const [showForm, setShowForm] = useState(false);

  if (isLoading) return <SkeletonExpenses />;

  if (!parte) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <p className="text-muted-foreground">Parte no encontrado.</p>
      </div>
    );
  }

  const isClosed = parte.status === "CERRADO";

  const closeForm = () => {
    setEditing(null);
    setShowForm(false);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <Button
        variant="ghost"
        className="px-0"
        onClick={() => router.push("/office-expenses")}
      >
        ← Volver
      </Button>

      <div className="flex flex-col items-center gap-4 md:flex-row md:justify-between">
        <div className="text-center md:text-left">
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            {officeExpenseTitle(parte)}
            <Badge variant={isClosed ? "secondary" : "default"}>
              {isClosed ? "Cerrado" : "Abierto"}
            </Badge>
          </h1>
          <p className="text-sm text-muted-foreground">
            Gastos de oficina · {expenses?.length ?? 0}{" "}
            {(expenses?.length ?? 0) === 1 ? "gasto" : "gastos"} ·{" "}
            <span className="font-semibold">
              {formatCurrency(parte.totalAmount)}
            </span>
          </p>
        </div>

        <div className="mb-2 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          {!isClosed && (
            <Button
              onClick={() => {
                setEditing(null);
                setShowForm(true);
              }}
            >
              Nuevo gasto
            </Button>
          )}

          {/* Cerrar el parte es la señal de "por mi parte, terminado". Deja de
              admitir gastos hasta que administración lo reabra. */}
          <Button
            variant="outline"
            onClick={() =>
              updateParte.mutate({
                officeExpenseId,
                data: { status: isClosed ? "ABIERTO" : "CERRADO" },
              })
            }
            disabled={updateParte.isPending}
          >
            {isClosed ? (
              <>
                <LockOpen className="mr-2 h-4 w-4" />
                Reabrir
              </>
            ) : (
              <>
                <Lock className="mr-2 h-4 w-4" />
                Cerrar parte
              </>
            )}
          </Button>
        </div>
      </div>

      {isClosed && (
        <Card className="border-dashed bg-muted/40">
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Este parte está cerrado: no admite gastos nuevos ni cambios. Pulsa
            «Reabrir» si necesitas seguir añadiendo tickets.
          </CardContent>
        </Card>
      )}

      {showForm && !isClosed && (
        <Card>
          <CardHeader>
            <CardTitle>{editing ? "Editar gasto" : "Nuevo gasto"}</CardTitle>
          </CardHeader>
          <CardContent>
            {/* scope="office": el select solo ofrece las 8 categorías de oficina
                y el OCR solo puede sugerir de esas. */}
            <ExpenseForm
              scope="office"
              officeExpenseId={officeExpenseId}
              initialData={editing || undefined}
              onSubmit={(values) => {
                if (editing) {
                  updateExpense.mutate(
                    { expenseId: editing.id, data: values },
                    { onSuccess: closeForm },
                  );
                } else {
                  createExpense.mutate(values, { onSuccess: closeForm });
                }
              }}
              onCancel={closeForm}
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
                className="flex flex-col gap-3 rounded border p-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex-1">
                  <p className="font-medium">
                    {exp.vendor || categoryLabel(exp.category)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(exp.date)} · {categoryLabel(exp.category)}
                    {exp.description ? ` · ${exp.description}` : ""}
                  </p>
                </div>
                <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                  <span className="text-center font-semibold sm:text-right">
                    {formatCurrency(exp.amount)}
                  </span>
                  {!isClosed && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={() => {
                          setEditing(exp);
                          setShowForm(true);
                        }}
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
                            del {formatDate(exp.date)}. El total del parte se
                            recalculará.
                          </>
                        }
                        confirmLabel="Eliminar gasto"
                        isPending={deleteExpense.isPending}
                        onConfirm={() => deleteExpense.mutate(exp.id)}
                        trigger={
                          <Button
                            variant="destructive"
                            size="sm"
                            className="w-full sm:w-auto"
                            disabled={deleteExpense.isPending}
                          >
                            Borrar
                          </Button>
                        }
                      />
                    </>
                  )}
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
