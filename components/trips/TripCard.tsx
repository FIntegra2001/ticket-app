"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { Edit3, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useTrip, useDeleteTrip } from "@/hooks/useTrips";
import { useAdminTrip } from "@/hooks/useAdminTrips";
import type { Trip } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  TRIP_STATUS_LABEL,
  TRIP_STATUS_VARIANT,
  acceptsExpenses,
} from "@/lib/trip-status";

interface TripCardProps {
  tripId: string;
  readOnly?: boolean; // USER: solo ve y carga gastos, sin editar/borrar viaje
  isAdmin?: boolean; // ADMIN: usa ruta admin + botones CRUD
  onEdit?: (trip: Trip) => void;
  onDelete?: (tripId: string) => void;
  /**
   * 🆕 Editar la propia solicitud (USER, solo mientras esté PENDIENTE).
   * Se separa de `onEdit` porque ese es el formulario completo del admin.
   */
  onEditRequest?: (trip: Trip) => void;
  /**
   * Estado de la mutación de borrado del padre. Necesario cuando se pasa
   * `onDelete`: en ese caso la mutación vive en el padre, no en esta card.
   */
  isDeleting?: boolean;
}

// ✅ Componente interno que recibe trip ya resuelto
function TripCardContent({
  trip,
  tripId,
  readOnly = false,
  isAdmin = false,
  onEdit,
  onDelete,
  onEditRequest,
  isDeleting,
}: TripCardProps & { trip: Trip }) {
  const deleteTrip = useDeleteTrip();
  // Si el padre gestiona el borrado, el estado pendiente es el suyo.
  const isDeletePending = isDeleting ?? deleteTrip.isPending;

  // 🆕 Solo un viaje APROBADO admite gastos. Mientras no lo esté, la card no
  // enlaza a la pantalla de gastos: el backend lo rechazaría con un 403.
  const canLoadExpenses = acceptsExpenses(trip.status);
  const isPending = trip.status === "PENDIENTE";

  const assignedNames = trip.assignedUsers
    ?.map((a) => a.user?.name)
    .filter(Boolean)
    .join(", ");

  // 🆕 Estado documental de un vistazo. Las rutas de admin devuelven
  // `documents` con solo `id` y `type`, que es cuanto hace falta aquí.
  const hasBillete = trip.documents?.some((d) => d.type === "BILLETE") ?? false;
  const hasReserva = trip.documents?.some((d) => d.type === "RESERVA") ?? false;

  const handleDelete = () => {
    if (onDelete) {
      onDelete(tripId);
    } else {
      deleteTrip.mutate(tripId);
    }
  };

  // ✅ Ruta de gastos según rol
  const expensesHref = isAdmin
    ? `/admin/trips/${tripId}/expenses`
    : `/trips/${tripId}/expenses`;

  return (
    <div className="relative">
      {/* 👇 Link que cubre toda la card — solo si el viaje admite gastos */}
      {canLoadExpenses && (
        <Link
          href={expensesHref}
          className="absolute inset-0 z-0"
          aria-label={`Ver gastos de ${trip.city}`}
        />
      )}
      <Card
        className={
          canLoadExpenses
            ? "w-full hover:shadow-lg transition-all border-2 hover:border-blue-200 cursor-pointer"
            : "w-full border-2 border-dashed bg-muted/40"
        }
      >
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start gap-2">
            <CardTitle
              className={`text-lg font-bold truncate flex-1 ${
                canLoadExpenses ? "" : "text-muted-foreground"
              }`}
            >
              {trip.city}
            </CardTitle>
            <Badge variant={TRIP_STATUS_VARIANT[trip.status]}>
              {TRIP_STATUS_LABEL[trip.status]}
            </Badge>
          </div>

          <div className="space-y-1 text-sm text-muted-foreground">
            <p>
              📅 {formatDate(trip.startDate)} — {formatDate(trip.endDate)}
            </p>
            {trip.project && <p>💼 {trip.project}</p>}
            {isAdmin && assignedNames && <p>👤 {assignedNames}</p>}
            {/* 🆕 Nº de factura interno: hasta ahora solo existía dentro del
                formulario, así que el admin no podía verlo sin abrir el viaje. */}
            {isAdmin && (
              <p className={trip.numberInvoice ? "" : "text-amber-600"}>
                🧾{" "}
                {trip.numberInvoice
                  ? `Nº factura: ${trip.numberInvoice}`
                  : "Sin nº de factura"}
              </p>
            )}
            {trip.notes && <p className="truncate italic">📝 {trip.notes}</p>}
          </div>

          {/* 🆕 Estado documental: ¿billete comprado? ¿hotel reservado? */}
          {isAdmin && (
            <div className="flex flex-wrap gap-2 pt-1">
              <Badge variant={hasBillete ? "default" : "outline"}>
                {hasBillete ? "✓" : "✗"} Billete
              </Badge>
              <Badge variant={hasReserva ? "default" : "outline"}>
                {hasReserva ? "✓" : "✗"} Reserva
              </Badge>
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
            <span className="font-semibold">Total:</span>
            <span className="text-2xl font-bold">
              {formatCurrency(trip.totalAmount)}
            </span>
          </div>

          <div className="flex gap-2 pt-2">
            {/* Gastos — solo si el viaje está aprobado */}
            {canLoadExpenses ? (
              <Button variant="outline" size="sm" className="flex-1" asChild>
                <Link href={expensesHref}>
                  <Plus className="w-4 h-4 mr-2" />
                  Gastos
                </Link>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                disabled
                title={
                  isPending
                    ? "Pendiente de que administración apruebe el viaje"
                    : "Viaje rechazado"
                }
              >
                {isPending ? "Sin aprobar" : "Rechazado"}
              </Button>
            )}

            {/* Editar — solo si no es readOnly y tiene handler.
                🆕 El USER edita su solicitud desde `onEditRequest` mientras siga
                pendiente; un viaje ya revisado no lo toca. */}
            {!readOnly && onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  onEdit(trip);
                }}
                className="relative z-10 px-3"
              >
                <Edit3 className="w-4 h-4" />
              </Button>
            )}

            {readOnly && isPending && onEditRequest && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    onEditRequest(trip);
                  }}
                  className="relative z-10"
                >
                  <Edit3 className="w-4 h-4 mr-2" />
                  Editar
                </Button>

                {/* 🆕 Retirar la solicitud. El backend solo lo permite si sigue
                    PENDIENTE y la creó este mismo usuario. */}
                <ConfirmDeleteDialog
                  title="¿Retirar la solicitud?"
                  description={
                    <>
                      Se eliminará tu solicitud de viaje a{" "}
                      <strong>{trip.city}</strong>. Podrás volver a solicitarlo
                      cuando quieras.
                    </>
                  }
                  confirmLabel="Retirar solicitud"
                  isPending={isDeletePending}
                  onConfirm={handleDelete}
                  trigger={
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isDeletePending}
                      className="relative z-10 px-3"
                      aria-label="Retirar solicitud"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  }
                />
              </>
            )}

            {/* Eliminar — solo admin, con doble check */}
            {isAdmin && (
              <ConfirmDeleteDialog
                title="¿Eliminar este viaje?"
                description={
                  <>
                    Vas a eliminar el viaje a <strong>{trip.city}</strong>. Se
                    borrarán también <strong>sus gastos</strong> y{" "}
                    <strong>sus documentos</strong> (billete y reserva). Esta
                    acción no se puede deshacer.
                  </>
                }
                confirmLabel="Eliminar viaje"
                isPending={isDeletePending}
                onConfirm={handleDelete}
                trigger={
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={isDeletePending}
                    className="relative z-10 px-3"
                    aria-label={`Eliminar viaje a ${trip.city}`}
                  >
                    {isDeletePending ? "⏳" : <Trash2 className="w-4 h-4" />}
                  </Button>
                }
              />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ✅ Wrapper para USER — usa /api/trips/:id (verifica asignación)
function UserTripCard(props: TripCardProps) {
  const { data: trip, isLoading } = useTrip(props.tripId);

  if (isLoading) return <CardSkeleton />;
  if (!trip) return null;

  return <TripCardContent {...props} trip={trip} />;
}

// ✅ Wrapper para ADMIN — usa /api/admin/trips/:id (sin restricción de ownership)
function AdminTripCard(props: TripCardProps) {
  const { data: trip, isLoading } = useAdminTrip(props.tripId);

  if (isLoading) return <CardSkeleton />;
  if (!trip) return null;

  return <TripCardContent {...props} trip={trip} />;
}

// ✅ Skeleton reutilizable
function CardSkeleton() {
  return <div className="animate-pulse bg-gray-200 h-80 w-full rounded-xl" />;
}

// ✅ Export principal — decide qué wrapper usar según isAdmin
export default function TripCard(props: TripCardProps) {
  if (props.isAdmin) {
    return <AdminTripCard {...props} />;
  }
  return <UserTripCard {...props} />;
}
