"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { CreateTripDto, StageInput, Trip } from "@/types";
import { formatDateForInput } from "@/lib/utils";
import { useUsers } from "@/hooks/useUser";
import { useCities } from "@/hooks/useCities";
import {
  checkStages,
  MAX_STAGES,
  nightsBetween,
  stageCityName,
} from "@/lib/trip-stages";
import { AlertTriangle, ArrowLeft, MapPin, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface TripFormProps {
  initialData?: Trip | null;
  onSubmit: (values: CreateTripDto) => void;
  onCancel: () => void;
  /**
   * "admin": formulario completo (nº de factura + asignados).
   * "request": un USER pide un viaje. Se ocultan el nº de factura (lo pone el
   * admin al aprobar) y el selector de usuarios (se autoasigna en el servidor).
   */
  mode?: "admin" | "request";
}

const emptyStage = (arrivalDate = ""): StageInput => ({
  cityId: "",
  cityOther: "",
  arrivalDate,
  departureDate: "",
});

/**
 * Fase 1: formulario de viaje con itinerario (uno o varios destinos).
 * Paso 1: datos + destinos. Paso 2: resumen antes de enviar.
 */
export default function TripForm({
  initialData,
  onSubmit,
  onCancel,
  mode = "admin",
}: TripFormProps) {
  const isRequest = mode === "request";
  // La lista de usuarios solo la puede pedir un ADMIN (modo "admin")
  const { users } = useUsers(!isRequest);
  const { data: cities = [] } = useCities();

  const [selectedUserIds, setSelectedUserIds] = React.useState<string[]>(
    initialData?.assignedUsers?.map((a) => a.userId) || [],
  );
  const [project, setProject] = React.useState(initialData?.project || "");
  const [notes, setNotes] = React.useState(initialData?.notes || "");
  const [numberInvoice, setNumberInvoice] = React.useState(
    initialData?.numberInvoice || "",
  );

  // Itinerario inicial: los tramos del viaje, o uno vacío
  const [stages, setStages] = React.useState<StageInput[]>(() =>
    initialData?.stages?.length
      ? [...initialData.stages]
          .sort((a, b) => a.position - b.position)
          .map((s) => ({
            cityId: s.cityId,
            cityOther: s.cityOther ?? "",
            arrivalDate: formatDateForInput(s.arrivalDate),
            departureDate: formatDateForInput(s.departureDate),
          }))
      : [
          {
            ...emptyStage(formatDateForInput(initialData?.startDate)),
            departureDate: formatDateForInput(initialData?.endDate),
          },
        ],
  );
  const combined = stages.length > 1;
  const [step, setStep] = React.useState<"form" | "summary">("form");

  // Viaje antiguo sin tramos: intentar casar su ciudad con el catálogo
  React.useEffect(() => {
    if (initialData?.stages?.length || !initialData?.city || cities.length === 0) return;
    setStages((prev) => {
      if (prev.length !== 1 || prev[0].cityId) return prev;
      const match = cities.find(
        (c) => c.name.toLowerCase() === initialData.city.toLowerCase(),
      );
      const other = cities.find((c) => c.isOther);
      const city = match ?? other;
      if (!city) return prev;
      return [{ ...prev[0], cityId: city.id, cityOther: match ? "" : initialData.city }];
    });
  }, [cities, initialData]);

  // Destinos que ya tienen gastos: no se pueden quitar
  const lastStageWithExpenses = React.useMemo(() => {
    const sorted = [...(initialData?.stages ?? [])].sort((a, b) => a.position - b.position);
    let last = 0;
    sorted.forEach((s, i) => {
      if (initialData?.expenses?.some((e) => e.stageId === s.id)) last = i + 1;
    });
    return last;
  }, [initialData]);

  const setStageCount = (n: number) => {
    if (n < lastStageWithExpenses) return;
    setStages((prev) => {
      if (n <= prev.length) return prev.slice(0, n);
      const next = [...prev];
      while (next.length < n) {
        next.push(emptyStage(next[next.length - 1]?.departureDate ?? ""));
      }
      return next;
    });
  };

  const updateStage = (i: number, patch: Partial<StageInput>) => {
    setStages((prev) => {
      const next = prev.map((s, j) => (j === i ? { ...s, ...patch } : s));
      // La llegada al siguiente destino se precarga con la salida de este
      if (patch.departureDate && next[i + 1] && !next[i + 1].arrivalDate) {
        next[i + 1] = { ...next[i + 1], arrivalDate: patch.departureDate };
      }
      return next;
    });
  };

  const { errors, warnings } = checkStages(stages, cities);
  const incomplete = stages.some((s) => !s.cityId || !s.arrivalDate || !s.departureDate);
  const canContinue =
    !incomplete && errors.length === 0 && (isRequest || selectedUserIds.length > 0);

  const cityById = (id: string) => cities.find((c) => c.id === id);
  const availableUsers = users?.filter((u) => u.role === "USER") || [];

  const handleSubmit = () => {
    onSubmit({
      stages: stages.map((s) => ({
        ...s,
        cityOther: cityById(s.cityId)?.isOther ? s.cityOther : undefined,
      })),
      project,
      notes,
      numberInvoice,
      assignedUserIds: selectedUserIds,
    });
  };

  // ------------------------------------------------------------ RESUMEN ----
  if (step === "summary") {
    const totalNights = stages.reduce(
      (acc, s) => acc + nightsBetween(s.arrivalDate, s.departureDate),
      0,
    );
    return (
      <div className="space-y-4">
        <h3 className="font-semibold text-lg">Revisa el viaje antes de enviarlo</h3>
        {project && (
          <p className="text-sm">
            <span className="text-muted-foreground">Proyecto:</span> {project}
          </p>
        )}
        <ol className="space-y-2">
          <li className="text-sm text-muted-foreground">Salida desde la oficina</li>
          {stages.map((s, i) => {
            const nights = nightsBetween(s.arrivalDate, s.departureDate);
            return (
              <li key={i} className="border rounded-lg p-3 bg-muted/40">
                <div className="font-medium flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  {combined && `Destino ${i + 1}: `}
                  {stageCityName({ cityOther: s.cityOther, city: cityById(s.cityId) })}
                </div>
                <div className="text-sm text-muted-foreground">
                  {s.arrivalDate} → {s.departureDate} · {nights}{" "}
                  {nights === 1 ? "noche" : "noches"}
                </div>
              </li>
            );
          })}
          <li className="text-sm text-muted-foreground">Vuelta a la oficina</li>
        </ol>
        <p className="text-sm">
          Total: <strong>{totalNights} noches</strong>
          {combined && ` en ${stages.length} destinos`}
        </p>
        {warnings.map((w, i) => (
          <p key={i} className="text-sm text-amber-700 flex gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {w.message}
          </p>
        ))}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => setStep("form")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Corregir
          </Button>
          <Button type="button" onClick={handleSubmit}>
            {isRequest
              ? initialData
                ? "Actualizar solicitud"
                : "Enviar solicitud"
              : `${initialData ? "Actualizar" : "Crear"} viaje`}
          </Button>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------- FORMULARIO ----
  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (canContinue) setStep("summary");
      }}
    >
      {isRequest && (
        <p className="text-sm text-muted-foreground bg-muted/50 border rounded-lg p-3">
          Administración revisará tu solicitud. Hasta que la apruebe podrás
          editarla, pero no cargar gastos.
        </p>
      )}

      {/* 1. Proyecto y motivo */}
      <div className="space-y-3">
        <div>
          <Label htmlFor="project">Proyecto</Label>
          <Input id="project" value={project} onChange={(e) => setProject(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="notes">{isRequest ? "Motivo del viaje" : "Notas"}</Label>
          <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>
      </div>

      {/* 2. ¿Viaje combinado? */}
      <div className="space-y-2">
        <Label>¿Viaje combinado (varias ciudades)?</Label>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={!combined ? "default" : "outline"}
            disabled={lastStageWithExpenses > 1}
            onClick={() => setStageCount(1)}
          >
            No, una ciudad
          </Button>
          <Button
            type="button"
            variant={combined ? "default" : "outline"}
            onClick={() => !combined && setStageCount(2)}
          >
            Sí, varias
          </Button>
        </div>
        {combined && (
          <div className="space-y-1">
            <Label>Nº de destinos</Label>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: MAX_STAGES - 1 }, (_, k) => k + 2)
                .slice(0, 5)
                .map((n) => (
                  <Button
                    key={n}
                    type="button"
                    size="sm"
                    variant={stages.length === n ? "default" : "outline"}
                    disabled={n < lastStageWithExpenses}
                    onClick={() => setStageCount(n)}
                    className="w-11"
                  >
                    {n}
                  </Button>
                ))}
            </div>
            {lastStageWithExpenses > 1 && (
              <p className="text-xs text-muted-foreground">
                No puedes quitar destinos que ya tienen gastos.
              </p>
            )}
          </div>
        )}
      </div>

      {/* 3. Destinos */}
      <div className="space-y-3">
        {stages.map((s, i) => {
          const city = cityById(s.cityId);
          const nights =
            s.arrivalDate && s.departureDate ? nightsBetween(s.arrivalDate, s.departureDate) : null;
          const stageErrors = errors.filter((e) => e.index === i);
          return (
            <div key={i} className="border rounded-lg p-3 space-y-3 bg-muted/30">
              <div className="font-medium flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                {combined ? `Destino ${i + 1}` : "Destino"}
              </div>
              <div>
                <Label>Ciudad *</Label>
                <Select value={s.cityId} onValueChange={(v) => updateStage(i, { cityId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una ciudad..." />
                  </SelectTrigger>
                  <SelectContent>
                    {cities.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                        {c.region && !c.isOther ? ` (${c.region})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {city?.isOther && (
                <div>
                  <Label>¿Qué ciudad? *</Label>
                  <Input
                    value={s.cityOther ?? ""}
                    onChange={(e) => updateStage(i, { cityOther: e.target.value })}
                    placeholder="Escribe la ciudad"
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>{i === 0 ? "Ida *" : "Llegada *"}</Label>
                  <Input
                    type="date"
                    value={s.arrivalDate}
                    onChange={(e) => updateStage(i, { arrivalDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label>{i === stages.length - 1 ? "Vuelta *" : "Salida *"}</Label>
                  <Input
                    type="date"
                    value={s.departureDate}
                    min={s.arrivalDate || undefined}
                    onChange={(e) => updateStage(i, { departureDate: e.target.value })}
                  />
                </div>
              </div>
              {nights !== null && nights >= 0 && (
                <p className="text-xs text-muted-foreground">
                  {nights} {nights === 1 ? "noche" : "noches"}
                </p>
              )}
              {stageErrors.map((e, k) => (
                <p key={k} className="text-sm text-destructive">
                  {e.message}
                </p>
              ))}
            </div>
          );
        })}
        {errors
          .filter((e) => e.index === null)
          .map((e, k) => (
            <p key={k} className="text-sm text-destructive">
              {e.message}
            </p>
          ))}
        {warnings.map((w, k) => (
          <p key={k} className="text-sm text-amber-700 flex gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {w.message}
          </p>
        ))}
      </div>

      {/* Nº de liquidación: lo rellena el admin, normalmente al aprobar */}
      {!isRequest && (
        <div>
          <Label htmlFor="numberInvoice">Nº Factura (liquidación)</Label>
          <Input
            id="numberInvoice"
            value={numberInvoice}
            onChange={(e) => setNumberInvoice(e.target.value)}
            placeholder="Nº de liquidación (4 cifras)"
          />
        </div>
      )}

      {/* Selector de usuarios — en una solicitud el USER se autoasigna */}
      {!isRequest && (
        <div className="space-y-2">
          <Label>Asignar usuarios *</Label>
          <Select
            onValueChange={(id) =>
              !selectedUserIds.includes(id) && setSelectedUserIds((p) => [...p, id])
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecciona un usuario..." />
            </SelectTrigger>
            <SelectContent>
              {availableUsers
                .filter((u) => !selectedUserIds.includes(u.id))
                .map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          {selectedUserIds.length > 0 ? (
            <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-muted/50">
              {selectedUserIds.map((uid) => {
                const user = availableUsers.find((u) => u.id === uid);
                return (
                  <Badge key={uid} variant="secondary" className="gap-1 pr-1">
                    {user?.name || uid}
                    <button
                      type="button"
                      onClick={() => setSelectedUserIds((p) => p.filter((id) => id !== uid))}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Debes asignar al menos un usuario</p>
          )}
        </div>
      )}

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!canContinue}>
          Revisar y continuar
        </Button>
      </div>
    </form>
  );
}
