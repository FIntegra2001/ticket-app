"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Banknote } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { mesNombre } from "@/lib/office-expenses";

/**
 * Fase 2: aviso al ADMIN de las transferencias pendientes del mes anterior
 * (adelantos personales). Desaparece cuando todo está marcado como transferido.
 */
export function ReimbursementAlert() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;

  const { data } = useQuery({
    queryKey: ["reimbursements-pending", year, month],
    queryFn: async () => {
      const res = await fetch(`/api/admin/reimbursements?year=${year}&month=${month}`);
      if (!res.ok) return null;
      const rows: { amount: number; paid: { amount: number } | null }[] = await res.json();
      const pending = rows.filter((r) => !r.paid || Math.abs(r.paid.amount - r.amount) > 0.005);
      return {
        people: pending.length,
        total: pending.reduce((a, r) => a + r.amount - (r.paid?.amount ?? 0), 0),
      };
    },
  });

  if (!data || data.people === 0) return null;

  return (
    <Link
      href="/admin/reimbursements"
      className="flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 hover:bg-amber-100 mb-6"
    >
      <Banknote className="w-6 h-6 text-amber-700 shrink-0" />
      <span>
        Transferencias de <span className="capitalize">{mesNombre(month)}</span> pendientes:{" "}
        <strong>{formatCurrency(data.total)}</strong> a {data.people} persona
        {data.people === 1 ? "" : "s"}. <span className="underline">Ver detalle</span>
      </span>
    </Link>
  );
}
