"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { Expense } from "@/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Label } from "../ui/label";
import { useOCR, useUploadReceipt } from "@/hooks/useOCR";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { ImageCapture } from "./ImageCapture"; // ✅ nuevo componente
import { compressImage } from "@/lib/compress-image";
import {
  getCategoriesByScope,
  type CategoryScope,
} from "@/lib/expense-categories";

type ExpenseFormValues = {
  date: Date;
  amount: number;
  category?: string;
  vendor?: string;
  description?: string;
  invoiceNumber?: string;
  paymentMethod?: string;
  receiptUrl?: string;
};

interface ExpenseFormProps {
  /** Viaje al que pertenece el gasto. Excluyente con `officeExpenseId`. */
  tripId?: string;
  /** 🆕 Parte de gastos de oficina al que pertenece. Excluyente con `tripId`. */
  officeExpenseId?: string;
  /**
   * 🆕 Contexto contable. Determina qué categorías se ofrecen en el select y
   * qué puede sugerir el OCR: las de viaje y las de oficina van a cuentas
   * distintas y no deben mezclarse.
   */
  scope?: CategoryScope;
  initialData?: Expense | null;
  onSubmit: (values: ExpenseFormValues) => void;
  onCancel: () => void;
}

export default function ExpenseForm({
  initialData,
  onSubmit,
  onCancel,
  tripId,
  officeExpenseId,
  scope = "trip",
}: ExpenseFormProps) {
  // Categorías del contexto: en un viaje solo salen las de viaje, en un parte de
  // oficina solo las de oficina.
  const categories = getCategoriesByScope(scope);
  const ocrMutation = useOCR();
  const uploadMutation = useUploadReceipt();

  const [receiptUrl, setReceiptUrl] = React.useState<string>(
    initialData?.receiptUrl || "",
  );
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(
    initialData?.receiptUrl || null,
  );
  // ✅ Estado string separado para el input de monto — permite borrar y escribir libremente
  const [amountRaw, setAmountRaw] = React.useState<string>(
    initialData ? String(Number(initialData.amount)) : "",
  );
  // ✅ Estado para bloquear el botón de submit mientras se guarda
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [values, setValues] = React.useState<ExpenseFormValues>({
    date: initialData ? new Date(initialData.date) : new Date(),
    amount: initialData ? Number(initialData.amount) : 0,
    category: initialData?.category || "",
    vendor: initialData?.vendor || "",
    description: initialData?.description || "",
    invoiceNumber: initialData?.invoiceNumber || "",
    paymentMethod: initialData?.paymentMethod || "Tarjeta",
    receiptUrl: initialData?.receiptUrl || "",
  });

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = e.target;
    setValues((prev) => ({
      ...prev,
      [name]: name === "amount" ? Number(value) : value,
    }));
  }

  /**
   * Maneja la selección de un archivo de ticket desde ImageCapture.
   * Flujo:
   *   1. Validar tipo y tamaño RAW (antes de comprimir)
   *   2. Comprimir → JPEG ~600KB
   *   3. Mostrar preview inmediato
   *   4. OCR + upload a Cloudinary en paralelo
   *   5. Rellenar campos con los datos extraídos
   * Manejo de errores:
   *   - Validación falla → toast + return (sin throw)
   *   - Compresión falla → toast + return (atrapado por try/catch global)
   *   - OCR/upload falla → toast + return (atrapado por try/catch global)
   */
  async function handleFileSelected(file: File) {
    // 1️⃣ Validación PREVIA (antes de gastar CPU comprimiendo)
    if (!file.type.startsWith("image/")) {
      toast.error("Por favor selecciona una imagen válida");
      return;
    }

    // Límite generoso pre-compresión: 25MB cubre cualquier foto de móvil moderno.
    // Si supera esto, probablemente sea un vídeo seleccionado por error.
    if (file.size > 25 * 1024 * 1024) {
      toast.error("La imagen es demasiado grande (máx 25MB)");
      return;
    }

    // 2️⃣ Todo el flujo en un solo try/catch — más predecible
    try {
      // Comprimir antes de cualquier otra cosa
      const compressed = await compressImage(file);

      // Preview local inmediato (mientras OCR y upload procesan en paralelo)
      const reader = new FileReader();
      reader.onloadend = () => setPreviewUrl(reader.result as string);
      reader.readAsDataURL(compressed);

      toast.info("Extrayendo datos del ticket");

      // OCR y upload en paralelo. El scope viaja al OCR para que sugiera
      // categorías del contexto correcto, y el id determina en qué carpeta de
      // Cloudinary acaba el ticket.
      const [ocrData, imageUrl] = await Promise.all([
        ocrMutation.mutateAsync({ image: compressed, scope }),
        uploadMutation.mutateAsync({
          image: compressed,
          tripId,
          officeExpenseId,
        }),
      ]);

      setReceiptUrl(imageUrl);
      setPreviewUrl(imageUrl);

      setValues((prev) => ({
        ...prev,
        vendor: ocrData.vendor || prev.vendor,
        amount: ocrData.amount || prev.amount,
        date: ocrData.date ? new Date(ocrData.date) : prev.date,
        invoiceNumber: ocrData.invoiceNumber || prev.invoiceNumber,
        category: ocrData.category || prev.category,
        receiptUrl: imageUrl,
      }));

      // Sincronizar el string visible del input de monto
      if (ocrData.amount) setAmountRaw(String(ocrData.amount));

      toast.success("Datos extraídos correctamente. Revisa y confirma.");
    } catch (error) {
      console.error("Error procesando ticket:", error);

      // Mensaje específico para errores conocidos
      if (error instanceof Error) {
        // Compresión: el error trae mensaje útil (ej: "Tu navegador no puede procesar fotos HEIC...")
        if (
          error.message.includes("HEIC") ||
          error.message.includes("imagen")
        ) {
          toast.error(error.message);
          return;
        }
      }

      toast.error("No se pudo procesar el ticket. Inténtalo nuevamente.");
    }
  }

  function handleRemoveImage() {
    setPreviewUrl(null);
    setReceiptUrl("");
    setValues((prev) => ({ ...prev, receiptUrl: "" }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Validar que el monto sea un número válido > 0
    const parsedAmount = parseFloat(amountRaw.replace(",", "."));
    if (!amountRaw || isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error("Introduce un monto válido");
      return;
    }
    if (isSubmitting) return; // guardia extra contra doble tap
    setIsSubmitting(true);
    try {
      onSubmit({ ...values, amount: parsedAmount, receiptUrl });
    } finally {
      // El padre cierra el modal; si no lo hace, desbloqueamos tras 3s
      setTimeout(() => setIsSubmitting(false), 3000);
    }
  }

  const isProcessing = ocrMutation.isPending || uploadMutation.isPending;

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      {/* ✅ Componente de captura extraído */}
      <ImageCapture
        previewUrl={previewUrl}
        receiptUrl={receiptUrl}
        isProcessing={isProcessing}
        onFileSelected={handleFileSelected}
        onRemove={handleRemoveImage}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Fecha</label>
          <Input
            type="date"
            name="date"
            value={values.date.toISOString().slice(0, 10)}
            onChange={(e) =>
              setValues((prev) => ({ ...prev, date: new Date(e.target.value) }))
            }
          />
        </div>
        <div>
          <label className="text-sm font-medium">Monto</label>
          {/* ✅ type="text" + inputMode="decimal" → teclado numérico en móvil,
              sin el comportamiento raro del type="number" (no se puede borrar el 0).
              El valor se convierte a number en handleSubmit. */}
          <Input
            type="text"
            inputMode="decimal"
            name="amount"
            value={amountRaw}
            onChange={(e) => {
              // Aceptar tanto "," como "." como separador decimal (locale móvil ES/LA)
              const raw = e.target.value.replace(/[^0-9.,]/g, "");
              setAmountRaw(raw);
              // Normalizar a punto para parseFloat
              const normalized = raw.replace(",", ".");
              const parsed = parseFloat(normalized);
              if (!isNaN(parsed)) {
                setValues((prev) => ({ ...prev, amount: parsed }));
              }
            }}
            placeholder="0.00"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Categoría</label>
          <Select
            value={values.category}
            onValueChange={(value) =>
              setValues((prev) => ({ ...prev, category: value }))
            }
            required
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecciona una categoría" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium">Proveedor</label>
          <Input
            name="vendor"
            value={values.vendor}
            onChange={handleChange}
            placeholder="Restaurante, taxi..."
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="invoiceNumber">NIF/CIF</Label>
          <Input
            name="invoiceNumber"
            value={values.invoiceNumber}
            onChange={handleChange}
            placeholder="1234567890"
          />
        </div>

        <div>
          <Label htmlFor="paymentMethod">Método de Pago *</Label>
          <Select
            value={values.paymentMethod}
            onValueChange={(value) =>
              setValues((prev) => ({ ...prev, paymentMethod: value }))
            }
            required
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecciona método" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Tarjeta">Santander tarj debito</SelectItem>
              <SelectItem value="Efectivo">Efectivo</SelectItem>
              <SelectItem value="Transferencia">
                Santander transferencia
              </SelectItem>
              <SelectItem value="Domiciliacion">
                Santander domiciliacion
              </SelectItem>
              <SelectItem value="Bankinter">Bankinter</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium">Descripción</label>
        <Textarea
          name="description"
          value={values.description}
          onChange={handleChange}
          rows={3}
          placeholder="Detalles adicionales..."
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={isProcessing || isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Guardando...
            </>
          ) : (
            <>{initialData ? "Actualizar" : "Guardar"} Gasto</>
          )}
        </Button>
      </div>
    </form>
  );
}
