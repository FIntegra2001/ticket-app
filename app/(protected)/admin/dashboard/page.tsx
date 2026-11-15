"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  CalendarClock,
  FileWarning,
  Hash,
  Inbox,
  Receipt,
  Briefcase,
  type LucideIcon,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ReimbursementAlert } from "@/components/admin/ReimbursementAlert";
import { formatDate } from "@/lib/utils";

type TripTask = {
  id: string;
  city: string;
  startDate: string;
  endDate: string;
  numberInvoice: string | null;
  people: string;
  detail?: string;
};
type Tasks = {
  pending: TripTask[];
  noInvoice: TripTask[];
  upcoming: TripTask[];
  missingDocs: TripTask[];
  ticketIssues: TripTask[];
  openOffice: { id: string; person: string; period: string; expenses: number }[];
  topCities: { city: string; trips: number }[];
};

// Fase 5: el panel del ADMIN es una bandeja de tareas, sin importes agregados.
// Las cifras económicas (con billetes y hotel) están en Facturas Integra.
export default function AdminDashboard() {
  const { data, isLoading } = useQuery<Tasks>({
    queryKey: ["admin-tasks"],
    queryFn: async () => {
      const res = await fetch("/api/admin/tasks");
      if (!res.ok) throw new Error("Error al cargar la bandeja");
      return res.json();
    },
    refetchInterval: 60_000,
  });

  const tripLink = (id: string) => `/admin/trips/${id}/expenses`;
  const totalPending = data
    ? data.pending.length + data.noInvoice.length + data.missingDocs.length + data.ticketIssues.length + data.openOffice.length
    : 0;

  return (
    <main className="max-w-6xl mx-auto flex flex-col gap-6 p-4 sm:p-6">
      <ReimbursementAlert />
      <div>
        <h1 className="text-3xl font-bold">Bandeja de tareas</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {isLoading ? "Cargando…" : totalPending ? `${totalPending} tareas pendientes` : "Todo al día"} · Los
          importes completos de cada viaje (con billetes y hotel) están en Facturas Integra.
        </p>
      </div>

      {isLoading || !data ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <TaskBlock icon={Inbox} title="Solicitudes por aprobar" items={data.pending} href="/admin/alltrips?tab=solicitudes" tripLink={tripLink} tone="amber" />
          <TaskBlock icon={Hash} title="Aprobados sin nº de liquidación" items={data.noInvoice} href="/admin/alltrips?tab=proximos" tripLink={tripLink} tone="amber" />
          <TaskBlock icon={FileWarning} title="Sin billete o sin reserva" items={data.missingDocs} href="/admin/alltrips?tab=proximos" tripLink={tripLink} tone="amber" />
          <TaskBlock icon={Receipt} title="Viajes terminados con tickets pendientes" items={data.ticketIssues} href="/admin/alltrips?tab=realizados" tripLink={tripLink} tone="amber" />
          <TaskBlock icon={CalendarClock} title="Próximos viajes (30 días)" items={data.upcoming} href="/admin/alltrips?tab=proximos" tripLink={tripLink} tone="neutral" />

          <section className="bg-white border rounded-lg p-4 space-y-3">
            <Header icon={Briefcase} title="Partes de oficina del mes anterior abiertos" count={data.openOffice.length} tone="amber" />
            <p className="text-xs text-muted-foreground">Facturas solo importa los partes CERRADOS.</p>
            {data.openOffice.length === 0 ? (
              <Empty />
            ) : (
              <ul className="divide-y">
                {data.openOffice.map((o) => (
                  <li key={o.id} className="py-2 text-sm flex justify-between gap-2">
                    <Link href={`/office-expenses/${o.id}`} className="font-medium hover:underline">
                      {o.person}
                    </Link>
                    <span className="text-muted-foreground">
                      {o.period} · {o.expenses} gastos
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="bg-white border rounded-lg p-4 space-y-3 md:col-span-2">
            <Header icon={AlertCircle} title="Ciudades más visitadas" tone="neutral" />
            <div className="flex flex-wrap gap-2">
              {data.topCities.map((c) => (
                <span key={c.city} className="text-sm bg-muted rounded-full px-3 py-1">
                  {c.city} · {c.trips} viajes
                </span>
              ))}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function Header({ icon: Icon, title, count, tone }: { icon: LucideIcon; title: string; count?: number; tone: "amber" | "neutral" }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-5 h-5 text-muted-foreground shrink-0" />
      <h2 className="font-semibold flex-1">{title}</h2>
      {count !== undefined && (
        <span
          className={`min-w-7 text-center rounded-full px-2 py-0.5 text-sm font-semibold ${
            count && tone === "amber" ? "bg-amber-500 text-white" : "bg-gray-100 text-gray-600"
          }`}
        >
          {count}
        </span>
      )}
    </div>
  );
}

function Empty() {
  return <p className="text-sm text-green-700">Nada pendiente.</p>;
}

function TaskBlock({
  icon,
  title,
  items,
  href,
  tripLink,
  tone,
}: {
  icon: LucideIcon;
  title: string;
  items: TripTask[];
  href: string;
  tripLink: (id: string) => string;
  tone: "amber" | "neutral";
}) {
  const shown = items.slice(0, 6);
  return (
    <section className="bg-white border rounded-lg p-4 space-y-3">
      <Header icon={icon} title={title} count={items.length} tone={tone} />
      {items.length === 0 ? (
        <Empty />
      ) : (
        <ul className="divide-y">
          {shown.map((t) => (
            <li key={t.id} className="py-2 text-sm">
              <Link href={tripLink(t.id)} className="font-medium hover:underline">
                {t.city}
              </Link>
              {t.numberInvoice && <span className="text-muted-foreground"> · Nº {t.numberInvoice}</span>}
              <div className="text-xs text-muted-foreground">
                {formatDate(t.startDate)} – {formatDate(t.endDate)}
                {t.people ? ` · ${t.people}` : ""}
                {t.detail ? <span className="text-amber-700"> · {t.detail}</span> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      {items.length > shown.length && (
        <Link href={href} className="text-sm text-indigo-600 hover:underline">
          Ver los {items.length} →
        </Link>
      )}
    </section>
  );
}
