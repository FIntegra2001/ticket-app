# 📋 PLAN PENDIENTE — Log de migración + Limpieza de Cloudinary (ventana 3 meses)

> **Estado:** ⏳ APROBADO EN DISEÑO, PENDIENTE DE IMPLEMENTAR (no se ha tocado código)
> **Creado:** sesión de septiembre 2026
> **Alcance:** pequeño y contenido. NO toca subida, OCR, Excel, auth ni el flujo de migración existente.

---

## 🎯 Objetivo (en palabras del usuario)

La arquitectura Cloudinary + SharePoint **funciona y se queda tal cual**. No se cambia a proxy, ni a S3, ni auto-borrado agresivo (hay ~28 años de margen en Cloudinary con el volumen actual: ~120 img/mes × ~600KB vs límite 25GB). Solo se añaden **dos cosas**:

1. **Registro visible de "última migración"** (solo ADMIN), en la sección de migración del profile. Hoy solo se sabe qué se migró entrando a SharePoint a mirar carpetas; se quiere ver desde la interfaz.
2. **Botón manual para limpiar Cloudinary** de lo que tenga **más de 3 meses** Y **ya esté confirmado en SharePoint**. Así Cloudinary mantiene una **ventana rodante de 3 meses** (los usuarios ven sus viajes recientes en la app vía `receiptUrl` de Cloudinary); lo más viejo se consulta directamente en SharePoint.

---

## ✅ Decisiones cerradas con el usuario

1. **Qué borra el botón:** SOLO lo confirmado en SharePoint **y** con más de 3 meses. Lo no migrado NO se toca (y se reporta). Cero riesgo de pérdida.
2. **Quién ve el log:** solo **ADMIN**, en la sección de migración (`components/admin/SharePointMigration.tsx`).
3. **Ticket borrado en la app:** se deja el enlace roto; el `receiptUrl` NO se actualiza. Quien necesite un ticket viejo lo busca en SharePoint a mano. (Ver imagen inline es "un plus de UX", no obligatorio.)

---

## 🔒 La parte crítica: cómo se comprueba "ya está en SharePoint"

El borrado verifica la existencia **en vivo en SharePoint**, archivo por archivo, ANTES de borrar de Cloudinary:
- Calcula la ruta SP que le corresponde a cada archivo de Cloudinary (misma lógica que la migración: `public_id` → `Año {yyyy}/TICKETS VIAJES/{mm}/{invoice}/{name}.{format}`).
- Graph `GET` a esa ruta. Si existe (200) → borra de Cloudinary. Si 404 → lo salta y lo reporta.
- Es la comprobación más segura: mira la realidad actual de SharePoint, no un log que podría estar desactualizado.

---

## 🛠️ Plan concreto de archivos

### Backend
1. **`prisma/schema.prisma`** — modelo nuevo `MigrationLog`:
   ```prisma
   model MigrationLog {
     id           String   @id @default(cuid())
     type         String   // "migration" | "cleanup"
     runAt        DateTime @default(now())
     targetYear   Int?
     targetMonth  Int?
     successCount Int      @default(0)  // migrados / borrados
     failedCount  Int      @default(0)
     skippedCount Int      @default(0)  // cleanup: no migrados en SP, se saltaron
     triggeredBy  String?               // userId del admin
     @@map("migration_logs")
   }
   ```
   → **1 migración de Prisma ADITIVA** (tabla nueva, no destructiva) sobre el Neon AWS de producción: `npx prisma migrate dev --name add_migration_log` (local) y aplicar en prod.

2. **`lib/microsoft-graph.ts`** — helper nuevo `fileExistsInSharePoint(folderPath, fileName): Promise<boolean>`. Reutiliza `getDriveId` / `getBasePath`. Graph `GET /drives/{driveId}/root:{fullPath}` → true si 200, false si 404.

3. **`app/api/admin/migrate-to-sharepoint/route.ts`** — sustituir el `logMigration` actual (que solo hace `console.log`) por un `INSERT` en `MigrationLog` (type `"migration"`, con `targetYear/targetMonth`, contadores y `triggeredBy`) al terminar el POST. Cambio mínimo, no altera la lógica de migración.

4. **NUEVA `app/api/admin/cleanup-cloudinary/route.ts`** (admin only):
   - `GET` = **previsualización (dry-run)**: lista lo que se borraría / se saltaría, sin borrar nada. Para confirmar antes.
   - `POST` = ejecuta: lista Cloudinary con **paginación** (`next_cursor`, no solo 500), filtra `created_at < hoy − 3 meses`, verifica cada uno en SP con `fileExistsInSharePoint`, borra solo los confirmados (`cloudinary.uploader.destroy(public_id)`), registra el run en `MigrationLog` (type `"cleanup"`). Devuelve resumen `{ borrados, saltados (no migrados), total }`.
   - Opcional menor: limpiar carpetas vacías resultantes (`delete_folder`).

5. **NUEVA `app/api/admin/migration-log/route.ts`** (GET, admin) — devuelve la última fila `migration` y la última `cleanup` para pintar la UI.

### Frontend
6. **`components/admin/SharePointMigration.tsx`**:
   - Panel nuevo "Última migración: {fecha} — {N} archivos ({mm/yyyy})" (fetch a `/api/admin/migration-log`).
   - Botón "Limpiar Cloudinary (>3 meses ya migrados)" con **confirmación** que muestra el dry-run (se borrarían N, se saltarían M) + resumen del resultado.
   - Corregir DOS textos obsoletos:
     - Línea que dice `Estructura: /TICKETS_CLOUDINARY/año/mes/numberInvoice/` → ya no aplica (la ruta real es `Contabilidad / Facturas General / Año {yyyy} / TICKETS VIAJES / {mm} / {invoice}`).
     - Nota final "Los archivos permanecerán en Cloudinary... elimínalos manualmente desde el panel de Cloudinary" → sustituir por la explicación de la limpieza automática con botón + ventana de 3 meses.

---

## ⚠️ Confirmaciones que quedaron pendientes al pausar

1. La feature del log **requiere la tabla nueva** → `prisma migrate` sobre el Neon AWS de producción (aditiva, segura). **Confirmar OK antes de ejecutar.**
2. "**>3 meses**" se medirá por `created_at` real del archivo en Cloudinary (`created_at < hoy − 3 meses`). **Confirmar que es el criterio correcto** (alternativa: usar el año/mes de la ruta `tickets/yyyy/mm/...`, que es el mes de subida).

---

## 📌 Notas técnicas / contexto útil para retomar

- **Subida real** (producción): `app/api/expenses/upload-receipt/route.ts` → Cloudinary `tickets/{año}/{mes}/{folderName}/{timestamp}_{name}.jpg`, donde `folderName` = `trip.numberInvoice` sanitizado o fallback `{ciudad}_day{n}`. El año/mes salen de la **fecha de subida**, no del ticket.
- **`lib/cloudinary.ts`** tiene un helper `uploadReceiptImage` que sube a `receipts/{userId}/{tripId}` — parece **código muerto/legacy** (la subida real la hace la ruta de arriba). Verificar antes de asumir nada.
- **OCR** (`app/api/expenses/ocr/route.ts`) es **independiente del almacenamiento**: recibe el `File` en base64 desde el navegador. No se toca.
- **Migración actual** (`app/api/admin/migrate-to-sharepoint/route.ts`): copia Cloudinary → SP pero **NO borra** de Cloudinary. `logMigration` solo hace `console.log`.
- **Graph** (`lib/microsoft-graph.ts`): auth por client credentials (permisos de APLICACIÓN, mismas creds `MICROSOFT_*` que ya funcionan). `getDriveId` resuelve la biblioteca `Contabilidad` vía `SHAREPOINT_LIBRARY_NAME` y cachea el driveId. `getBasePath` = `SHAREPOINT_FOLDER_PATH` (`/Facturas General`).
- **Vercel Hobby**: crons limitados (no se usan aquí; todo es manual con botón).
- **`Expense.receiptUrl`** es `String?` y guarda la `secure_url` de Cloudinary; se usa como `<img src>` en el form y en las páginas de gastos.

---

## 🚦 Cómo retomar

- **Opción A (recomendada):** abrir este archivo y decir a Claude "ejecuta el plan de `.documents/PLAN_log-migracion-y-limpieza-cloudinary.md`".
- **Opción B:** `claude --resume` (o `claude -r`) para reabrir esta sesión con todo el contexto, si sigue disponible localmente.
