"use client";

import { useMutation } from "@tanstack/react-query";
import type { CategoryScope } from "@/lib/expense-categories";

interface OCRResult {
  vendor: string | null;
  amount: number | null;
  date: string | null;
  invoiceNumber: string | null;
  category: string | null;
  description: string | null;
}

export function useOCR() {
  return useMutation({
    mutationFn: async ({
      image,
      scope = "trip",
    }: {
      image: File;
      /**
       * 🆕 Contexto del gasto. Decide qué categorías puede sugerir el modelo:
       * en un parte de oficina un taxi es "TaxiOficina" (62900000019), no "Taxi"
       * (62900000006). Por defecto "trip", para no cambiar el comportamiento
       * existente.
       */
      scope?: CategoryScope;
    }): Promise<OCRResult> => {
      const formData = new FormData();
      formData.append("image", image);
      formData.append("scope", scope);

      const res = await fetch("/api/expenses/ocr", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Error processing image");
      }

      const { data } = await res.json();
      return data;
    },
  });
}

export function useUploadReceipt() {
  return useMutation({
    mutationFn: async ({
      image,
      tripId,
      officeExpenseId,
    }: {
      image: File;
      /** Uno de los dos, nunca ambos: el ticket cuelga de un viaje o de un parte. */
      tripId?: string;
      officeExpenseId?: string;
    }): Promise<string> => {
      const formData = new FormData();
      formData.append("image", image);
      if (tripId) formData.append("tripId", tripId);
      if (officeExpenseId) formData.append("officeExpenseId", officeExpenseId);

      const res = await fetch("/api/expenses/upload-receipt", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Error uploading image");
      }

      const { url } = await res.json();
      return url;
    },
  });
}
