"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/utils";
import { mesNombre } from "@/lib/office-expenses";

type Row = {
  userId: string;
  name: string | null;
  email: string;
  amount: number;
  tripCount: number;
  officeCount: number;
  kmCount: number;
  paid: { amount: number; paidAt: string } | null;
};

/** Mes anterior al actual: es el que se transfiere a principios de mes. */
function previousMonth() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

// Fase 2: transferencias de fin de mes por adelantos personales. Solo ADMIN.
export default function ReimbursementsPage() {
  const queryClient = useQueryClient();
  const [period, setPeriod] = React.useState(previousMonth);
  const key = ["reimbursements", period.year, period.month];

  const { data: rows = [], isLoading } = useQuery<Row[]>({
    queryKey: key,
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/reimbursements?year=${period.year}&month=${period.month}`,
      );
      if (!res.ok) throw new Error("Error al cargar");
      return res.json();
    },
  });

  const mark = useMutation({
    mutationFn: async ({ userId, paid }: { userId: string; paid: boolean }) => {
      const res = await fetch("/api/admin/reimbursements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, paid, ...period }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Error");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key });
      queryClient.invalidateQueries({ queryKey: ["reimbursements-pending"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const move = (delta: number) =>
    setPeriod((p) => {
      const d = new Date(p.year, p.month - 1 + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() + 1 };
    });

  const pending = rows.filter((r) => !r.paid || Math.abs(r.paid.amount - r.amount) > 0.005);
  const totalPending = pending.reduce(
    (a, r) => a + r.amount - (r.paid?.amount ?? 0),
    0,
  );
  const title = `${mesNombre(period.month)} ${period.year}`;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reembolsos</h1>
        <p className="text-sm text-muted-foreground">
          Gastos pagados como adelanto personal (incluido kilometraje), por persona.
        </p>
      </div>

      <div className="flex items-center justify-between bg-white border rounded-lg p-2">
        <Button variant="ghost" size="icon" onClick={() => move(-1)} aria-label="Mes anterior">
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <span className="font-medium capitalize">{title}</span>
        <Button variant="ghost" size="icon" onClick={() => move(1)} aria-label="Mes siguiente">
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay adelantos personales en {title}.</p>
      ) : (
        <>
          <div
            className={`rounded-lg p-4 border ${
              pending.length ? "bg-amber-50 border-amber-300" : "bg-green-50 border-green-300"
            }`}
          >
            {pending.length ? (
              <p>
                Pendiente de transferir: <strong>{formatCurrency(totalPending)}</strong> a{" "}
                {pending.length} persona{pending.length === 1 ? "" : "s"}.
              </p>
            ) : (
              <p>Todo transferido en {title}.</p>
            )}
          </div>

          <div className="space-y-2">
            {rows.map((r) => {
              const changed = r.paid && Math.abs(r.paid.amount - r.amount) > 0.005;
              return (
                <div
                  key={r.userId}
                  className="bg-white border rounded-lg p-4 flex flex-col sm:flex-row sm:items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{r.name ?? r.email}</span>
                      {r.paid && !changed && (
                        <Badge className="bg-green-100 text-green-800">
                          Transferido {formatDate(r.paid.paidAt)}
                        </Badge>
                      )}
                      {changed && (
                        <Badge className="bg-amber-100 text-amber-800">
                          Cambió tras transferir ({formatCurrency(r.paid!.amount)})
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {r.tripCount} de viaje · {r.officeCount} de oficina
                      {r.kmCount ? ` · ${r.kmCount} kilometraje` : ""}
                    </p>
                  </div>
                  <span className="text-lg font-semibold">{formatCurrency(r.amount)}</span>
                  <Button
                    size="sm"
                    variant={r.paid && !changed ? "outline" : "default"}
                    disabled={mark.isPending}
                    onClick={() =>
                      mark.mutate({ userId: r.userId, paid: !r.paid || !!changed })
                    }
                  >
                    {r.paid && !changed ? "Deshacer" : "Marcar transferido"}
                  </Button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
