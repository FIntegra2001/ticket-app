"use client";

import * as React from "react";
import Image from "next/image";
import { toast } from "sonner";
import {
  Download,
  FileText,
  Hotel,
  Loader2,
  Plane,
  Trash2,
  Upload,
} from "lucide-react";

import {
  useDeleteTripDocument,
  useTripDocuments,
  useUploadTripDocument,
} from "@/hooks/useTripDocuments";
import type { TripDocument, TripDocumentType } from "@/types";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { compressImage } from "@/lib/compress-image";
import {
  ALLOWED_DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABEL,
  MAX_DOCUMENT_BYTES,
  documentFileHref,
} from "@/lib/trip-documents";

interface TripDocumentsProps {
  tripId: string;
  /** El ADMIN ve además los controles de subida y borrado. */
  isAdmin?: boolean;
}

const VIEWABLE_TYPES: TripDocumentType[] = ["BILLETE", "RESERVA"];

const TYPE_ICON: Record<TripDocumentType, React.ElementType> = {
  BILLETE: Plane,
  RESERVA: Hotel,
  OTRO: FileText,
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Billete y reserva del viaje, encima del listado de gastos.
 *
 * El USER solo ve y descarga — es el objetivo de la feature: dejar de pedirle el
 * billete al admin por correo. El ADMIN sube y borra desde aquí mismo.
 */
export default function TripDocuments({
  tripId,
  isAdmin = false,
}: TripDocumentsProps) {
  const { data: documents, isLoading } = useTripDocuments(tripId);
  const upload = useUploadTripDocument(tripId);
  const remove = useDeleteTripDocument(tripId);

  const [viewing, setViewing] = React.useState<TripDocument | null>(null);
  // Qué tipo se está subiendo: sirve para saber a qué ranura mandar el fichero
  // que elija el usuario en el input, que es uno solo y compartido.
  const [uploadingType, setUploadingType] =
    React.useState<TripDocumentType | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const docsByType = (type: TripDocumentType) =>
    documents?.filter((d) => d.type === type) ?? [];

  const openPicker = (type: TripDocumentType) => {
    setUploadingType(type);
    inputRef.current?.click();
  };

  const handleFileSelected = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    // Se limpia siempre para que elegir el mismo fichero dos veces vuelva a disparar el change
    e.target.value = "";
    if (!file || !uploadingType) return;

    if (!(ALLOWED_DOCUMENT_TYPES as readonly string[]).includes(file.type)) {
      toast.error(
        `Formato no admitido (${file.type || "desconocido"}). Sube un PDF o una imagen.`,
      );
      return;
    }

    try {
      // Las imágenes sí se pueden comprimir (Canvas): una foto de 8 MB baja a
      // ~600 KB. Un PDF no: comprimirlo de verdad exige recomprimir sus imágenes
      // internas (Ghostscript), que no corre en Vercel. Va tal cual, con tope.
      let toUpload = file;
      if (file.type.startsWith("image/")) {
        toUpload = await compressImage(file);
      } else if (file.size > MAX_DOCUMENT_BYTES) {
        toast.error(
          `El PDF pesa ${formatSize(file.size)} y el máximo es 4 MB. Si es un escaneo, hazle una foto: las imágenes se comprimen solas.`,
        );
        return;
      }

      upload.mutate({ file: toUpload, type: uploadingType });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo procesar el fichero",
      );
    } finally {
      setUploadingType(null);
    }
  };

  const isPdf = viewing?.mimeType === "application/pdf";

  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Documentos del viaje</h2>
        {isLoading && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        {VIEWABLE_TYPES.map((type) => {
          const docs = docsByType(type);
          const Icon = TYPE_ICON[type];
          const isUploadingThis = upload.isPending && uploadingType === type;

          return (
            <div key={type} className="flex-1 space-y-2">
              {docs.length > 0 ? (
                docs.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      className="flex-1 justify-start"
                      onClick={() => setViewing(doc)}
                    >
                      <Icon className="mr-2 h-4 w-4" />
                      Ver {DOCUMENT_TYPE_LABEL[type].toLowerCase()}
                    </Button>
                    <Button variant="ghost" size="sm" asChild>
                      <a
                        href={documentFileHref(tripId, doc.id, {
                          download: true,
                        })}
                        aria-label={`Descargar ${doc.fileName}`}
                      >
                        <Download className="h-4 w-4" />
                      </a>
                    </Button>
                    {isAdmin && (
                      <ConfirmDeleteDialog
                        title="¿Eliminar este documento?"
                        description={
                          <>
                            Se eliminará <strong>{doc.fileName}</strong> del
                            viaje y de Cloudinary. El usuario dejará de verlo.
                          </>
                        }
                        confirmLabel="Eliminar documento"
                        isPending={remove.isPending}
                        onConfirm={() => remove.mutate(doc.id)}
                        trigger={
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={remove.isPending}
                            aria-label="Eliminar documento"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        }
                      />
                    )}
                  </div>
                ))
              ) : (
                <Button
                  variant="outline"
                  className="w-full justify-start text-muted-foreground"
                  disabled
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {DOCUMENT_TYPE_LABEL[type]}: no disponible
                </Button>
              )}

              {isAdmin && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  disabled={upload.isPending}
                  onClick={() => openPicker(type)}
                >
                  {isUploadingThis ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Subiendo…
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Subir {docs.length > 0 ? "otro " : ""}
                      {DOCUMENT_TYPE_LABEL[type].toLowerCase()}
                    </>
                  )}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {!isAdmin && documents?.length === 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          Cuando administración suba el billete o la reserva, aparecerán aquí.
        </p>
      )}

      {isAdmin && (
        <>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            onChange={handleFileSelected}
          />
          <p className="mt-3 text-xs text-muted-foreground">
            PDF o imagen, máximo 4 MB. Las imágenes se comprimen
            automáticamente; los PDF se suben tal cual.
          </p>
        </>
      )}

      {/* Visor */}
      <Dialog
        open={!!viewing}
        onOpenChange={(open) => {
          if (!open) setViewing(null);
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="pr-8 text-base">
              {viewing ? DOCUMENT_TYPE_LABEL[viewing.type] : ""}
              {viewing ? (
                <span className="block text-xs font-normal text-muted-foreground">
                  {viewing.fileName} · {formatSize(viewing.size)}
                </span>
              ) : null}
            </DialogTitle>
          </DialogHeader>

          {/* Tanto el iframe como la imagen tiran de la ruta de la app, no de
              Cloudinary: la de Cloudinary es pública y además serviría el PDF
              como octet-stream (el navegador lo descargaría en vez de mostrarlo). */}
          {viewing &&
            (isPdf ? (
              <iframe
                src={documentFileHref(tripId, viewing.id)}
                title={viewing.fileName}
                className="h-[70vh] w-full rounded border"
              />
            ) : (
              <div className="relative h-[70vh] w-full">
                <Image
                  src={documentFileHref(tripId, viewing.id)}
                  alt={viewing.fileName}
                  fill
                  unoptimized
                  className="rounded object-contain"
                />
              </div>
            ))}

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" asChild>
              <a
                href={viewing ? documentFileHref(tripId, viewing.id) : "#"}
                target="_blank"
                rel="noopener noreferrer"
              >
                Abrir en pestaña nueva
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a
                href={
                  viewing
                    ? documentFileHref(tripId, viewing.id, { download: true })
                    : "#"
                }
              >
                <Download className="mr-2 h-4 w-4" />
                Descargar
              </a>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
