"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { useUserContext } from "@/context/userContext";
import type {
  CreateExpenseDto,
  CreateOfficeExpenseDto,
  Expense,
  OfficeExpense,
  UpdateExpenseDto,
  UpdateOfficeExpenseDto,
} from "@/types";

/** Respuesta paginada de los partes. Nota: la clave es `officeExpenses`, no `trips`. */
type PaginatedOfficeExpenses = {
  officeExpenses: OfficeExpense[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasMore: boolean;
  };
};

/* ===============================
   Mis partes de gastos de oficina
================================ */
export function useOfficeExpenses() {
  const { user } = useUserContext();

  return useInfiniteQuery<PaginatedOfficeExpenses>({
    queryKey: ["officeExpenses", user?.id],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await fetch(`/api/office-expenses?page=${pageParam}&limit=12`, {
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Error al cargar los partes");
      }
      return res.json();
    },
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? lastPage.pagination.page + 1 : undefined,
    initialPageParam: 1,
    enabled: !!user?.id,
  });
}

export function useOfficeExpense(officeExpenseId: string) {
  return useQuery<OfficeExpense>({
    queryKey: ["officeExpense", officeExpenseId],
    queryFn: async () => {
      const res = await fetch(`/api/office-expenses/${officeExpenseId}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Error al cargar el parte");
      }
      return res.json();
    },
    enabled: !!officeExpenseId,
  });
}

/** Todos los partes (ADMIN). */
export function useAdminOfficeExpenses(page: number = 1, limit: number = 15) {
  return useQuery<PaginatedOfficeExpenses>({
    queryKey: ["adminOfficeExpenses", page, limit],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/office-expenses?page=${page}&limit=${limit}`,
        { credentials: "include" },
      );
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Error al cargar los partes");
      }
      return res.json();
    },
  });
}

/** Claves que hay que refrescar tras cualquier cambio en un parte o sus gastos. */
function invalidateOfficeQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  officeExpenseId: string | undefined,
  userId: string | undefined,
) {
  if (officeExpenseId) {
    queryClient.invalidateQueries({
      queryKey: ["officeExpense", officeExpenseId],
    });
    queryClient.invalidateQueries({
      queryKey: ["officeExpenseItems", officeExpenseId],
    });
  }
  if (userId) {
    queryClient.invalidateQueries({ queryKey: ["officeExpenses", userId] });
  }
  queryClient.invalidateQueries({ queryKey: ["adminOfficeExpenses"] });
}

/* ===============================
   Crear / editar / borrar parte
================================ */
export function useCreateOfficeExpense() {
  const queryClient = useQueryClient();
  const { user } = useUserContext();

  return useMutation({
    mutationFn: async (data: CreateOfficeExpenseDto) => {
      const res = await fetch("/api/office-expenses", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Error al crear el parte");
      }
      // 200 = ya existía el parte de ese mes; 201 = recién creado
      return { parte: (await res.json()) as OfficeExpense, created: res.status === 201 };
    },
    onSuccess: ({ parte, created }) => {
      invalidateOfficeQueries(queryClient, parte.id, user?.id);
      toast.success(
        created
          ? "Parte de gastos creado"
          : "Ya tenías un parte de ese mes: te llevo a él",
      );
    },
    onError: (error) => {
      console.error("Error creating office expense:", error);
      toast.error(
        error instanceof Error ? error.message : "No se pudo crear el parte",
      );
    },
  });
}

export function useUpdateOfficeExpense() {
  const queryClient = useQueryClient();
  const { user } = useUserContext();

  return useMutation({
    mutationFn: async ({
      officeExpenseId,
      data,
    }: {
      officeExpenseId: string;
      data: UpdateOfficeExpenseDto;
    }) => {
      const res = await fetch(`/api/office-expenses/${officeExpenseId}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Error al actualizar el parte");
      }
      return res.json() as Promise<OfficeExpense>;
    },
    onSuccess: (parte) => {
      invalidateOfficeQueries(queryClient, parte.id, user?.id);
      toast.success("Parte actualizado");
    },
    onError: (error) => {
      console.error("Error updating office expense:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo actualizar el parte",
      );
    },
  });
}

export function useDeleteOfficeExpense() {
  const queryClient = useQueryClient();
  const { user } = useUserContext();

  return useMutation({
    mutationFn: async (officeExpenseId: string) => {
      const res = await fetch(`/api/office-expenses/${officeExpenseId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Error al eliminar el parte");
      }
      return res.json();
    },
    onSuccess: (_, officeExpenseId) => {
      queryClient.removeQueries({
        queryKey: ["officeExpense", officeExpenseId],
      });
      invalidateOfficeQueries(queryClient, undefined, user?.id);
      toast.success("Parte eliminado");
    },
    onError: (error) => {
      console.error("Error deleting office expense:", error);
      toast.error(
        error instanceof Error ? error.message : "No se pudo eliminar el parte",
      );
    },
  });
}

/* ===============================
   Gastos dentro de un parte
================================ */
export function useOfficeExpenseItems(officeExpenseId: string) {
  return useQuery<Expense[]>({
    queryKey: ["officeExpenseItems", officeExpenseId],
    queryFn: async () => {
      const res = await fetch(
        `/api/office-expenses/${officeExpenseId}/expenses`,
        { credentials: "include" },
      );
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Error al cargar los gastos");
      }
      return res.json();
    },
    enabled: !!officeExpenseId,
  });
}

export function useCreateOfficeExpenseItem(officeExpenseId: string) {
  const queryClient = useQueryClient();
  const { user } = useUserContext();

  return useMutation({
    mutationFn: async (data: CreateExpenseDto) => {
      const res = await fetch(
        `/api/office-expenses/${officeExpenseId}/expenses`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        },
      );
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Error al crear el gasto");
      }
      return res.json();
    },
    onSuccess: () => {
      invalidateOfficeQueries(queryClient, officeExpenseId, user?.id);
      toast.success("Gasto añadido");
    },
    onError: (error) => {
      console.error("Error creating office expense item:", error);
      toast.error(
        error instanceof Error ? error.message : "No se pudo crear el gasto",
      );
    },
  });
}

export function useUpdateOfficeExpenseItem(officeExpenseId: string) {
  const queryClient = useQueryClient();
  const { user } = useUserContext();

  return useMutation({
    mutationFn: async ({
      expenseId,
      data,
    }: {
      expenseId: string;
      data: UpdateExpenseDto;
    }) => {
      const res = await fetch(
        `/api/office-expenses/${officeExpenseId}/expenses/${expenseId}`,
        {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        },
      );
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Error al actualizar el gasto");
      }
      return res.json();
    },
    onSuccess: () => {
      invalidateOfficeQueries(queryClient, officeExpenseId, user?.id);
      toast.success("Gasto actualizado");
    },
    onError: (error) => {
      console.error("Error updating office expense item:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo actualizar el gasto",
      );
    },
  });
}

export function useDeleteOfficeExpenseItem(officeExpenseId: string) {
  const queryClient = useQueryClient();
  const { user } = useUserContext();

  return useMutation({
    mutationFn: async (expenseId: string) => {
      const res = await fetch(
        `/api/office-expenses/${officeExpenseId}/expenses/${expenseId}`,
        { method: "DELETE", credentials: "include" },
      );
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Error al eliminar el gasto");
      }
      return res.json();
    },
    onSuccess: () => {
      invalidateOfficeQueries(queryClient, officeExpenseId, user?.id);
      toast.success("Gasto eliminado");
    },
    onError: (error) => {
      console.error("Error deleting office expense item:", error);
      toast.error(
        error instanceof Error ? error.message : "No se pudo eliminar el gasto",
      );
    },
  });
}

/* ===============================
   Exports
================================ */
async function downloadBlob(res: Response, fileName: string) {
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function useExportOfficeExpenses(scope: "mine" | "all" = "mine") {
  return useMutation({
    mutationFn: async () => {
      const endpoint =
        scope === "all"
          ? "/api/admin/office-expenses/export"
          : "/api/office-expenses/export";
      const res = await fetch(endpoint, { credentials: "include" });
      if (!res.ok) throw new Error("Error exporting office expenses");

      const prefix =
        scope === "all" ? "gastos-oficina-completo" : "mis-gastos-oficina";
      await downloadBlob(
        res,
        `${prefix}-${new Date().toISOString().slice(0, 10)}.xlsx`,
      );
    },
    onError: (error) => {
      console.error("Error exporting office expenses:", error);
      toast.error("No se pudo generar el Excel de gastos de oficina");
    },
  });
}
