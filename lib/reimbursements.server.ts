// Fase 2: reembolsos de fin de mes. Suma, por persona, los gastos pagados como
// adelanto personal ("Efectivo") en un mes, de viajes y de oficina.
import prisma from "@/lib/db";
import { PERSONAL_ADVANCE } from "@/lib/mileage";

export type ReimbursementRow = {
  userId: string;
  name: string | null;
  email: string;
  amount: number;
  tripCount: number;
  officeCount: number;
  kmCount: number;
  paid: { amount: number; paidAt: string } | null;
};

/**
 * Quién pagó un gasto: en oficina, el dueño del parte; en viaje, quien lo
 * registró (desde la Fase 2). Para gastos antiguos: el único asignado o, si hay
 * varios, el que solicitó el viaje (y si no, el primero asignado).
 */
export async function getReimbursements(year: number, month: number) {
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 1));

  const expenses = await prisma.expense.findMany({
    where: { paymentMethod: PERSONAL_ADVANCE, date: { gte: from, lt: to } },
    select: {
      amount: true,
      kmOneWay: true,
      createdById: true,
      officeExpense: { select: { userId: true } },
      trip: {
        select: {
          requestedById: true,
          assignedUsers: { select: { userId: true }, orderBy: { createdAt: "asc" } },
        },
      },
    },
  });

  const rows = new Map<string, Omit<ReimbursementRow, "name" | "email" | "paid">>();
  for (const e of expenses) {
    const userId =
      e.officeExpense?.userId ??
      e.createdById ??
      (e.trip?.assignedUsers.length === 1
        ? e.trip.assignedUsers[0].userId
        : e.trip?.requestedById ?? e.trip?.assignedUsers[0]?.userId);
    if (!userId) continue;
    const r = rows.get(userId) ?? { userId, amount: 0, tripCount: 0, officeCount: 0, kmCount: 0 };
    r.amount = Math.round((r.amount + Number(e.amount)) * 100) / 100;
    if (e.officeExpense) r.officeCount++;
    else r.tripCount++;
    if (e.kmOneWay != null) r.kmCount++;
    rows.set(userId, r);
  }

  const [users, paid] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: [...rows.keys()] } },
      select: { id: true, name: true, email: true },
    }),
    prisma.reimbursement.findMany({ where: { year, month } }),
  ]);

  return [...rows.values()]
    .map((r): ReimbursementRow => {
      const u = users.find((x) => x.id === r.userId);
      const p = paid.find((x) => x.userId === r.userId);
      return {
        ...r,
        name: u?.name ?? null,
        email: u?.email ?? "",
        paid: p ? { amount: Number(p.amount), paidAt: p.paidAt.toISOString() } : null,
      };
    })
    .sort((a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email));
}
