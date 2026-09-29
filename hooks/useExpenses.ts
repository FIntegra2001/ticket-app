"use client";

import { useUserContext } from "@/context/userContext";
import { CreateExpenseDto, UpdateExpenseDto, Expense } from "@/types";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

/* ===============================
   Obtener expenses de un trip
================================ */
export function useExpenses(tripId: string) {
  const { user } = useUserContext();
  
  return useQuery<Expense[]>({
    queryKey: ["expenses", tripId],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${tripId}/expenses`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Error fetching expenses");
      }
      
      return res.json();
    },
    enabled: !!tripId && !!user?.id,
  });
}

/* ===============================
   Crear expense
================================ */
export function useCreateExpense(tripId: string) {
  const queryClient = useQueryClient();
  const { user } = useUserContext();

  return useMutation({
    mutationFn: async (data: Omit<CreateExpenseDto, "tripId">) => {
      const res = await fetch(`/api/trips/${tripId}/expenses`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Error creating expense");
      }
      
      return res.json();
    },
    onSuccess: (newExpense: Expense) => {
      // Queries de usuario
      queryClient.invalidateQueries({ queryKey: ["expenses", tripId] });
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ["trips", user.id] });
        // El dashboard del usuario lee ["tripStats"]: sin esto quedaba desfasado
        queryClient.invalidateQueries({ queryKey: ["tripStats", user.id] });
      }
      
      // ✅ Queries de admin — para que se refresque si el admin está viendo el trip
      queryClient.invalidateQueries({ queryKey: ["adminTrip", tripId] });
      queryClient.invalidateQueries({ queryKey: ["adminTrips"] });
      queryClient.invalidateQueries({ queryKey: ["adminTripsTable"] });
      queryClient.invalidateQueries({ queryKey: ["adminTripStats"] });

      // Actualizar cache local
      queryClient.setQueryData<Expense[]>(["expenses", tripId], (old) =>
        old ? [newExpense, ...old] : [newExpense]
      );
    },
    onError: (error) => {
      console.error("Error creating expense:", error);
    },
  });
}

/* ===============================
   Editar expense
================================ */
export function useUpdateExpense(tripId: string) {
  const queryClient = useQueryClient();
  const { user } = useUserContext();

  return useMutation({
    mutationFn: async ({
      expenseId,
      data,
    }: {
      expenseId: string;
      data: Partial<UpdateExpenseDto>;
    }) => {
      const res = await fetch(`/api/trips/${tripId}/expenses/${expenseId}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Error updating expense");
      }
      
      return res.json();
    },
    onSuccess: (updatedExpense: Expense) => {
      // Queries de usuario
      queryClient.invalidateQueries({ queryKey: ["expenses", tripId] });
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ["trips", user.id] });
        // El dashboard del usuario lee ["tripStats"]: sin esto quedaba desfasado
        queryClient.invalidateQueries({ queryKey: ["tripStats", user.id] });
      }

      // ✅ Queries de admin
      queryClient.invalidateQueries({ queryKey: ["adminTrip", tripId] });
      queryClient.invalidateQueries({ queryKey: ["adminTrips"] });
      queryClient.invalidateQueries({ queryKey: ["adminTripsTable"] });
      queryClient.invalidateQueries({ queryKey: ["adminTripStats"] });

      // Actualizar cache local
      queryClient.setQueryData<Expense[]>(["expenses", tripId], (old) => {
        if (!old) return [updatedExpense];
        return old.map((e) => e.id === updatedExpense.id ? updatedExpense : e);
      });
    },
    onError: (error) => {
      console.error("Error updating expense:", error);
    },
  });
}

/* ===============================
   Eliminar expense
================================ */
export function useDeleteExpense(tripId: string) {
  const queryClient = useQueryClient();
  const { user } = useUserContext();

  return useMutation({
    mutationFn: async (expenseId: string) => {
      const res = await fetch(`/api/trips/${tripId}/expenses/${expenseId}`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Error deleting expense");
      }
      
      return res.json();
    },
    onSuccess: (_, expenseId) => {
      // Queries de usuario
      queryClient.invalidateQueries({ queryKey: ["expenses", tripId] });
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ["trips", user.id] });
        // El dashboard del usuario lee ["tripStats"]: sin esto quedaba desfasado
        queryClient.invalidateQueries({ queryKey: ["tripStats", user.id] });
      }

      // ✅ Queries de admin
      queryClient.invalidateQueries({ queryKey: ["adminTrip", tripId] });
      queryClient.invalidateQueries({ queryKey: ["adminTrips"] });
      queryClient.invalidateQueries({ queryKey: ["adminTripsTable"] });
      queryClient.invalidateQueries({ queryKey: ["adminTripStats"] });

      // Actualizar cache local
      queryClient.setQueryData<Expense[]>(["expenses", tripId], (old) =>
        old ? old.filter((e) => e.id !== expenseId) : []
      );

      toast.success("Gasto eliminado");
    },
    onError: (error) => {
      console.error("Error deleting expense:", error);
      toast.error(
        error instanceof Error ? error.message : "No se pudo eliminar el gasto"
      );
    },
  });
}