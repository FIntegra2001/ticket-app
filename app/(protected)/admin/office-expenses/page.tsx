"use client";

import { useState } from "react";
import Link from "next/link";
import {
  useAdminOfficeExpenses,
  useExportOfficeExpenses,
} from "@/hooks/useOfficeExpenses";
import type { OfficeExpense } from "@/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { officeExpenseTitle } from "@/lib/office-expenses";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
} from "lucide-react";

export default function AdminOfficeExpensesPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 15;

  const { data, isLoading } = useAdminOfficeExpenses(currentPage, limit);
  const exportExcel = useExportOfficeExpenses("all");

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 p-8">
        <Skeleton className="h-10 w-96" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const partes = data?.officeExpenses ?? [];
  const pagination = data?.pagination;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-8">
      <div className="flex flex-col items-center gap-4 md:flex-row md:justify-between">
        <div className="text-center md:text-left">
          <h1 className="text-4xl font-bold">Gastos de oficina</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {pagination
              ? `${pagination.totalCount} ${
                  pagination.totalCount === 1 ? "parte" : "partes"
                } de todos los usuarios`
              : "Partes de todos los usuarios"}
          </p>
        </div>

        <Button
          onClick={() => exportExcel.mutate()}
          disabled={exportExcel.isPending || partes.length === 0}
          className="mb-3"
        >
          {exportExcel.isPending ? (
            <>
              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
              Exportando...
            </>
          ) : (
            <>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Exportar gastos de oficina
            </>
          )}
        </Button>
      </div>

      {partes.length > 0 ? (
        <>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Parte</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Gastos</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Notas</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partes.map((parte: OfficeExpense) => (
                  <TableRow key={parte.id}>
                    <TableCell className="font-medium">
                      {officeExpenseTitle(parte)}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{parte.user?.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {parte.user?.email}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          parte.status === "CERRADO" ? "secondary" : "default"
                        }
                      >
                        {parte.status === "CERRADO" ? "Cerrado" : "Abierto"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {parte.expenses?.length ?? 0}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(parte.totalAmount)}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                      {parte.notes ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/office-expenses/${parte.id}`}>
                          Ver gastos
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => p - 1)}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Anterior
              </Button>
              <span className="text-sm text-muted-foreground">
                Página {pagination.page} de {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={!pagination.hasMore}
                onClick={() => setCurrentPage((p) => p + 1)}
              >
                Siguiente
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Building2 className="mb-4 h-16 w-16 text-muted-foreground" />
          <h2 className="mb-2 text-xl font-semibold">
            Todavía no hay partes de gastos de oficina
          </h2>
          <p className="max-w-sm text-muted-foreground">
            Cuando los usuarios creen su parte del mes y carguen tickets,
            aparecerán aquí.
          </p>
        </div>
      )}
    </div>
  );
}
