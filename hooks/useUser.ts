"use client";

import { getUsers } from "@/actions/fetch-data";
import { User } from "@/types";
import { useState, useEffect } from "react";
import { toast } from "sonner";

interface UseUsersResult {
  users: User[];
  isLoading: boolean;
  error: string | null;
}

export function useUsers(enabled = true): UseUsersResult {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getUsers();
      setUsers(data);
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Error desconocido al cargar usuarios.";
      setError(errorMessage);
      toast.error(`Error al cargar usuarios: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (enabled) fetchUsers();
  }, [enabled]);

  return { users, isLoading, error };
}
