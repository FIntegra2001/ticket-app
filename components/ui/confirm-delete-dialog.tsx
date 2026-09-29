"use client";

import * as React from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ConfirmDeleteDialogProps {
  /** Botón (u otro elemento) que abre el diálogo. Se le pasan las props del trigger. */
  trigger: React.ReactNode;
  title?: string;
  /** Qué se va a borrar y qué consecuencias tiene. Sé explícito con las cascadas. */
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Deshabilita el botón de confirmar mientras la mutación está en vuelo. */
  isPending?: boolean;
  onConfirm: () => void;
}

/**
 * Doble check para acciones destructivas.
 *
 * Nota: el trigger hace `stopPropagation` en lugar de `preventDefault` a
 * propósito. Radix compone los handlers con `checkForDefaultPrevented`, así que
 * un `preventDefault` en el trigger impediría que el diálogo se abriera. Con
 * `stopPropagation` el clic no llega a contenedores clicables (p. ej. el `<Link>`
 * que cubre toda la TripCard) y el diálogo sí se abre.
 */
export function ConfirmDeleteDialog({
  trigger,
  title = "¿Seguro que quieres eliminarlo?",
  description,
  confirmLabel = "Eliminar",
  cancelLabel = "Cancelar",
  isPending = false,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        asChild
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        {trigger}
      </AlertDialogTrigger>
      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isPending}
            className={cn(buttonVariants({ variant: "destructive" }))}
          >
            {isPending ? "Eliminando…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default ConfirmDeleteDialog;
