# 📊 RESUMEN EJECUTIVO - APP DE GESTIÓN DE GASTOS DE VIAJE

> **Versión:** 3.0.0
> **Última actualización:** Sesión OCR (modelo retirado) + repunte SharePoint (junio 2026)
> **Status:** ✅ En producción + PWA + OCR en Haiku 4.5 + SharePoint apuntando a Financiero/Contabilidad

---

## 🆕 CAMBIOS DE ESTA SESIÓN (v2 → v3)

1. **OCR caído en producción → arreglado.** El modelo `claude-sonnet-4-20250514` fue **retirado por Anthropic el 15/06/2026** y empezó a devolver `404 not_found_error`. No era un timeout ni nada de red: el calendario. Migrado a **Haiku 4.5** (`claude-haiku-4-5`).
2. **Route de OCR endurecido** (`/api/expenses/ocr`): modelo como constante, validación de tipo de imagen, `JSON.parse` protegido, y manejo de errores que distingue 404 (config) / 429-529 (saturación, reintentable) / resto. Se acabó el 500 genérico que ocultó el problema 3 días.
3. **`description` ya NO se extrae en OCR** (por petición de negocio). El campo sigue existiendo en el modelo `Expense` para entrada manual.
4. **Migración SharePoint apunta a un sitio/biblioteca nuevos.** De `RETO_TECNOLOGICO` (biblioteca por defecto) a **`FinancieroyContabilidad` → biblioteca `Contabilidad`**.
5. **`lib/microsoft-graph.ts` refactorizado** para soportar bibliotecas que no son la de por defecto (`getDriveId` + `SHAREPOINT_LIBRARY_NAME`) y rutas relativas (`getBasePath` + `SHAREPOINT_FOLDER_PATH`).
6. **Reestructurada la ruta de destino** para que el año salga del propio ticket (`Año {yyyy}`), evitando duplicación y sin tocar nada cada enero.
7. **Lección aprendida:** los model strings *fechados* caducan; usar aliases sin fecha. Y Graph Explorer prueba con permisos **delegados** (tu usuario), no con los de **aplicación** (los de la app), así que su `accessDenied` puede ser una pista falsa.

---

## 🎯 Propósito
Sistema full-stack para gestionar gastos de viaje empresarial con OCR automático, validación de administrador y exportación contable. Disponible como **PWA instalable** en iOS y Android.

---

## 🏗️ ARQUITECTURA TÉCNICA

### Stack
- **Frontend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** Next.js API Routes (sobre Vercel Functions con Fluid Compute)
- **Base de datos:** Neon PostgreSQL + Prisma ORM
- **Autenticación:** BetterAuth (roles: USER, ADMIN) + Microsoft OAuth
- **OCR:** 🆕 **Claude Haiku 4.5** (`claude-haiku-4-5`) - ~$0.09/mes para 120 imágenes (~12x más barato que Sonnet)
- **Storage:** Cloudinary (plan free: 25GB)
- **Migración:** Microsoft Graph API → SharePoint (permisos de **aplicación**, `Sites.ReadWrite.All`)
- **Export:** ExcelJS (35 columnas contables)
- **Deploy:** Vercel Hobby (con Fluid Compute habilitado)
- **PWA:** Service Worker custom + manifest.json (sin librerías externas)

### Project Structure
```
mi-ticket-app/
├── app/
│   ├── (protected)/        # Rutas autenticadas
│   ├── api/
│   ├── auth/
│   ├── generated/
│   ├── favicon.ico         # Se mueve a /public en versión PWA
│   ├── globals.css
│   ├── layout.tsx          # Con metadata PWA
│   └── page.tsx
├── components/
│   ├── Navigation.tsx
│   ├── ExpenseForm.tsx
│   ├── ImageCapture.tsx
│   ├── SharePointMigration.tsx
│   ├── pwa-install-section.tsx
│   └── service-worker-register.tsx
│   └── ui/                 # shadcn components
├── context/
│   └── userContext.tsx
├── hooks/
│   ├── useOCR.ts
│   ├── useTrips.ts
│   ├── useAdminTrips.ts
│   ├── useExpenses.ts
│   └── use-install-prompt.ts
├── lib/
│   ├── auth.ts
│   ├── prisma.ts
│   ├── cloudinary.ts
│   ├── microsoft-graph.ts  # 🆕 Refactor: getDriveId + getBasePath
│   └── compress-image.ts
├── prisma/
├── providers/
│   └── QueryProvider.tsx
├── public/
│   ├── manifest.json
│   ├── sw.js
│   ├── favicon.ico
│   └── icons/              # 4 iconos PWA
├── types/
└── vercel.json             # Headers para SW
```

### Idioma
- **Español (es-ES)** - toda la UI y mensajes

---

## 📊 MODELO DE DATOS

```
User
├─ id, name, email, role (USER | ADMIN)
└─ BetterAuth integration (Microsoft OAuth)

Trip (creado por ADMIN)
├─ id, city (Select con ciudades), startDate, endDate
├─ project, notes, status (PENDIENTE | APROBADO | RECHAZADO)
├─ numberInvoice (número factura interno del financiero)
├─ totalAmount (calculado automáticamente)
├─ createdByAdminId
└─ assignedUsers[] (many-to-many via TripAssignment)

TripAssignment (tabla pivot)
├─ tripId
└─ userId

Expense (creado por USER o ADMIN)
├─ id, tripId, amount, date
├─ category (Taxi, Comida, Hotel, Metrobus/Parking, Gasolina, Ave, Avion, ComidasOficina)
├─ vendor, description, paymentMethod   # description: entrada manual (ya NO se extrae por OCR)
├─ invoiceNumber (NIF/CIF del proveedor - extraído por OCR)
├─ receiptUrl (Cloudinary URL)
├─ createdByAdminId (si lo creó admin = badge especial)
└─ createdAt, updatedAt
```

---

## 🔐 FLUJO DE TRABAJO

### ADMIN:
1. **Crear viaje:**
   - Selecciona ciudad (desplegable con 16 ciudades)
   - Define fechas, proyecto, notas
   - Asigna a uno o más usuarios (multi-select)
   - Opcionalmente: añade `numberInvoice` (número factura interno)

2. **Gestionar:**
   - Ve TODOS los viajes (tabla paginada con filtros por usuario + status)
   - Edita/elimina cualquier viaje
   - Cambia status: PENDIENTE → APROBADO/RECHAZADO
   - Crea/edita/elimina gastos en cualquier viaje

3. **Exportar:**
   - Excel completo (todos los viajes, 35 columnas contables)
   - Dashboard con estadísticas globales

4. **Migrar a SharePoint:**
   - Botón manual en profile page
   - Selecciona mes/año
   - Migra archivos de Cloudinary → SharePoint
   - 🆕 Destino: `Contabilidad / Facturas General / Año {yyyy} / TICKETS VIAJES / {mm} / {numberInvoice} /`

### USER:
1. **Ver viajes asignados:**
   - Solo ve trips donde está en `assignedUsers`
   - Infinite scroll (9 inicial, +6 más)

2. **Crear gastos:**
   - Sube foto del ticket (cámara o galería)
   - Compresión automática client-side antes de subir
   - OCR automático extrae: vendor, amount, date, invoiceNumber, category
   - Usuario revisa y confirma
   - Imagen se guarda en Cloudinary: `tickets/año/mes/numberInvoice/timestamp_archivo.jpg`

3. **Exportar:**
   - Excel personal (solo sus viajes asignados, 35 columnas)
   - Dashboard con sus estadísticas

---

## 🎨 ESTRUCTURA DE PÁGINAS

### Usuario:
- `/trips` - Lista de viajes asignados (cards con infinite scroll)
- `/trips/[id]/expenses` - Gestión de gastos del viaje
- `/dashboard` - Estadísticas personales
- `/profile` - Perfil del usuario + sección PWA install

### Admin:
- `/admin` - Tabla de TODOS los viajes (paginación clásica, 15/página, filtros)
- `/admin/alltrips` - Cards con CRUD (infinite scroll)
- `/admin/trips/[tripId]/expenses` - Ver/editar/eliminar gastos
- `/admin/dashboard` - Estadísticas globales
- `/profile` - Incluye sección de migración a SharePoint + PWA install

---

## 🔌 API ROUTES

### User Routes (con ownership check):
```
GET/POST   /api/trips
GET/PUT/DELETE /api/trips/[tripId]
GET/POST   /api/trips/[tripId]/expenses
GET/PUT/DELETE /api/trips/[tripId]/expenses/[expenseId]
GET        /api/trips/stats
GET        /api/trips/export (Excel personal)
```

### Admin Routes:
```
GET/POST   /api/admin/trips
GET/PUT/DELETE /api/admin/trips/[tripId]
PUT        /api/admin/trips/[tripId]/status
GET        /api/admin/trips/stats
GET        /api/admin/export (Excel completo)
GET/POST   /api/admin/migrate-to-sharepoint
```

### Utilities:
```
POST /api/expenses/ocr (Claude Vision OCR)
POST /api/expenses/upload-receipt (Cloudinary upload)
```

---

## 🤖 OCR CON CLAUDE VISION

### Modelo: 🆕 `claude-haiku-4-5`
> Alias **sin fecha** a propósito: apunta siempre al último snapshot de Haiku 4.5 y no se rompe por retiradas de versión (versión fijada equivalente: `claude-haiku-4-5-20251001`).
> ⚠️ El modelo anterior `claude-sonnet-4-20250514` fue retirado el 15/06/2026 → devolvía `404`. Lección: no usar strings fechados en producción sin vigilar las fechas de retirada (Anthropic avisa por email con ~60 días).

### Input: Foto del ticket (ya comprimida desde el cliente)
### Output:
```json
{
  "vendor": "Nombre del establecimiento",
  "amount": 45.50,
  "date": "2026-03-12",
  "invoiceNumber": "B87654321",
  "category": "Comida"
}
```
> `description` ya NO se solicita (decisión de negocio). Si vuelve a hacer falta, se reañade al prompt y a la interfaz `OCRResult`.

### Categorías reconocidas:
- Taxi, Comida, Hotel, Metrobus/Parking, Gasolina, Ave, Avion, ComidasOficina
  (`Ave` = tren AVE/Renfe · `Avion` = vuelos · `ComidasOficina` = catering oficina)

### Endurecimiento del route (`/api/expenses/ocr/route.ts`):
- `OCR_MODEL` como constante arriba del archivo → cambiar modelo = 1 línea.
- Valida `image.type` (jpeg/png/webp) ANTES de gastar tokens.
- `JSON.parse` protegido con try/catch → si el modelo devuelve algo raro, responde 502 limpio en vez de tumbar la request con 500.
- Errores de `Anthropic.APIError` tipados:
  - **404** → modelo no disponible (fallo de config) → avisar admin.
  - **429 / 529** → saturación → `retryable: true` con status 503.
  - resto → 502 si ≥500, o el status original.

### Costes estimados:
- 120 imágenes/mes con **Haiku 4.5** = **~$0.09 USD/mes** (antes ~$1.03 con Sonnet)

---

## 📱 PWA (Progressive Web App)

### Implementación
- **Sin librerías externas** (no `next-pwa`, no `workbox`) — solo Service Worker nativo + manifest
- **Service Worker custom** (`/public/sw.js`):
  - Cache-first para assets estáticos (`/_next/static/`, iconos, fuentes)
  - Cache-first para imágenes de Cloudinary (tickets ya subidos)
  - Network-first con fallback para navegación HTML
  - **NUNCA cachea `/api/*`** — crítico para OCR, uploads, auth, mutaciones
- **Registro solo en producción** (`NODE_ENV === "production"`) para no romper HMR

> 💡 **Actualizaciones y PWA:** instalar la PWA NO congela el código. Los cambios de servidor (`/api/*`) llegan al instante (no se cachean). Los de cliente llegan solos porque Next pone hash en los bundles. Reinstalar solo haría falta si cambia el `manifest.json`. Único matiz: la nueva lógica del `sw.js` puede tardar en activarse si el usuario nunca cierra la app (mitigable con `skipWaiting()` + `clients.claim()` o un toast "nueva versión disponible").

### Manifest minimalista (4 iconos)
```
public/icons/
├── icon-192x192.png
├── icon-512x512.png
├── icon-maskable-512x512.png
└── apple-touch-icon.png
```

### Hook `useInstallPrompt`
- Detecta `beforeinstallprompt` (Chrome/Edge/Android)
- Detecta `display-mode: standalone` (ya instalada)
- Detecta iOS (Safari no soporta el evento → muestra instrucciones manuales)
- **Lazy initializer** en `useState` para evitar setState síncrono en useEffect

### Configuración Vercel
- **`vercel.json`** con headers `Cache-Control: max-age=0` para `/sw.js` y `/manifest.json`
- **Fluid Compute** activo → permite `maxDuration: 300s` incluso en Hobby (no fijado; usa defaults)

---

## 🖼️ COMPRESIÓN DE IMÁGENES (CLIENT-SIDE)

### El problema que resolvía
Móviles Android modernos generaban fotos de **8-15 MB** que superaban el límite de **4.5 MB** del body de Vercel Functions y los **5 MB** de Claude Vision, y tardaban demasiado en 4G débil. iOS funcionaba (Safari convierte HEIC→JPEG); Android no.

### Solución: `lib/compress-image.ts`
- 100% client-side, Canvas API nativo, sin dependencias
- `createImageBitmap({ imageOrientation: "from-image" })` → corrige rotación EXIF
- Redimensiona a máx **1600x1600 px**, JPEG calidad 0.85
- Si supera 4 MB, baja calidad progresivamente (0.85 → 0.70 → 0.55 → 0.40), luego reduce dimensiones
- Detecta HEIC en Android y muestra error claro
- Resultado típico: 8.5 MB → **~600 KB** (93% menos), sin pérdida perceptible para OCR

### Integración en `ExpenseForm.tsx`
Validación PREVIA → comprimir → preview local → OCR + upload en paralelo (`Promise.all`) → auto-fill. Un solo try/catch (mensaje específico para HEIC).

---

## 📁 CLOUDINARY → SHAREPOINT  🆕 (REVISADO)

### Estructura en Cloudinary (NO cambia):
```
tickets/
  2026/
    03/
      FAC-2024-001/   ← numberInvoice del trip
        1773231259782_ticket.jpg
```

### Destino en SharePoint (NUEVO):
```
Sitio:        FinancieroyContabilidad
Biblioteca:   Contabilidad           (NO es la de por defecto "Documentos")
Carpeta base: /Facturas General
Resultado:    Contabilidad / Facturas General / Año 2026 / TICKETS VIAJES / 03 / FAC-2024-001 / archivo.jpg
```

### Cómo funciona el código de migración
- `lib/microsoft-graph.ts`:
  - `getDriveId(client, siteId)` → si existe `SHAREPOINT_LIBRARY_NAME`, busca en `/sites/{id}/drives` la biblioteca con ese `name`; si no, usa `/sites/{id}/drive` (la de por defecto). Cachea el driveId.
  - `getBasePath()` → lee `SHAREPOINT_FOLDER_PATH` (ruta **relativa a la raíz de la biblioteca**, NO el path `/sites/...`).
  - `uploadFileToSharePoint()` usa `/drives/{driveId}/root:{fullPath}:/content`. Si da 404, crea las carpetas con `createFolderPath()` y reintenta.
- `app/api/admin/migrate-to-sharepoint/route.ts` construye el `folderPath` a partir del `public_id` de Cloudinary. 🆕 Reestructurado para que el año salga del ticket:
  ```typescript
  const pathParts = file.public_id.split("/");   // ["tickets","2026","03","158","archivo"]
  const [, yyyy, mm, invoice] = pathParts;
  const folderPath = `Año ${yyyy}/TICKETS VIAJES/${mm}/${invoice}`;
  const fileName = pathParts[pathParts.length - 1] + "." + file.format;
  ```

### Mantenimiento por años (sin tocar código)
- `createFolderPath` crea "Año 2027", "Año 2028"... automáticamente la primera vez que se migra un ticket de ese año.
- ⚠️ **Convención con financiero:** las carpetas de año deben llamarse EXACTAMENTE `Año 2027` (misma grafía, sin espacios extra ni mayúsculas distintas). Si financiero las crea con otro nombre, Graph las trata como carpetas distintas y los tickets quedarían separados.

### 🔎 Script diagnóstico: `test-sharepoint.mjs`
Pide token con client credentials (igual que la app) y lista las bibliotecas del sitio con su `driveId` y `webUrl`. Sirve para (a) confirmar que la **app** accede al sitio, y (b) descubrir el `name` literal de la biblioteca. Ejecutar: `node --env-file=.env test-sharepoint.mjs`.
> Bibliotecas detectadas en FinancieroyContabilidad: `Documentos`, **`Contabilidad`**, `Financiero`, `Protectorado`, `Patronato`, `Direcciones para combinar correspondencia`.

---

## 📊 EXCEL EXPORT (35 COLUMNAS)

### Columnas principales:
1. fecha, MÉTODO DE PAGO, CUENTA, CONCEPTO, SUBCONCEPTO
2. EUROS, IVA, IMPORTE IVA, IMPORTE_TOTAL
3. subcuenta contabilidad (códigos: 62900000006, etc.)
4. PROVEEDOR, **NIF/CIF** (`expense.invoiceNumber`), **Nº FACTURA** (`trip.numberInvoice`)
5. COMENTARIOS (Gastos de viaje {ciudad} {fechas} {usuarios} {proyecto})
6. MES, Cobro, mes imputacion, IMPUTACION, PROYECTO, PERSONAL, CIUDAD

### Mapeos especiales:
```typescript
SUBCUENTAS_CONTABILIDAD = {
  Taxi: "62900000006",
  Comida: "62900000024",
  Hotel: "62900000039",
  ComidasOficina: "62900000022",
}

BANCOS = {
  Tarjeta: "Santander tarj debito",
  Efectivo: "Efectivo",
  Transferencia: "Santander transferencia",
  Domiciliacion: "Santander domiciliacion",
  Bankinter: "Bankinter"
}
```

### Diferencias:
- **Admin Excel:** Todos los viajes
- **User Excel:** Solo viajes asignados

---

## 🎨 UI/UX PATTERNS

### Infinite Scroll
- Cards: 9 inicial, +6 por scroll. Hook: `useInfiniteQuery` (React Query)

### Paginación Clásica
- Tabla admin: 15 items/página, controles Anterior/Siguiente + número

### Forms
- **TripForm:** Ciudad (Select), fechas, proyecto, usuarios (multi-select badges), numberInvoice
- **ExpenseForm:** OCR scan, campos auto-rellenados, validación inline
  - **`amountRaw` (string)** + `amount` (number) separados → permite escribir `,` o `.` libremente
  - `inputMode="decimal"` → teclado numérico en móvil
  - `isSubmitting` con timeout de 3s como guardia anti doble-tap
  - **`ImageCapture`** como componente separado

### TripCard (dual mode)
```tsx
isAdmin ? <AdminTripCard /> : <UserTripCard />
```

### Toasts
- Sonner para feedback

---

## 🔒 PERMISOS Y SEGURIDAD

| Acción | USER | ADMIN |
|--------|------|-------|
| Crear trip | ❌ | ✅ |
| Ver trips | ✅ (asignados) | ✅ (todos) |
| Editar/Eliminar trip | ❌ | ✅ |
| Cambiar status | ❌ | ✅ |
| Crear/Editar/Eliminar expense | ✅ (asignados) | ✅ (cualquiera) |
| Export Excel | ✅ (propio) | ✅ (completo) |
| Migrar a SharePoint | ❌ | ✅ |

### API Security
- BetterAuth session check en todas las rutas
- User routes: verifican `assignedUsers.some(userId)`
- Admin routes: verifican `role === "ADMIN"`

### Microsoft Graph (importante)
- La app usa permisos de **aplicación** (`Sites.ReadWrite.All` + admin consent) → acceso a todos los sitios del tenant.
- **Graph Explorer usa permisos DELEGADOS** (tu usuario). Un `accessDenied` ahí NO significa que la app no pueda entrar. Para probar el acceso real de la app, usar `test-sharepoint.mjs` (client credentials).

---

## 🐛 BUGS RESUELTOS (HISTÓRICO COMPLETO)

### Sesión inicial
1. **numberInvoice no se guardaba** → faltaba en POST/PUT de API routes
2. **Excel columnas desordenadas** → usar arrays en `addRow` en vez de objetos
3. **Hydration errors** → `suppressHydrationWarning` + ClientOnly wrapper
4. **Cloudinary tripId difícil** → usar `trip.numberInvoice` para nombre de carpeta

### Sesión PWA
5. **Icono PWA inicial sin display:standalone** → reinstalar tras subir manifest válido
6. **setState síncrono en useEffect** del hook `useInstallPrompt` → lazy initializer

### Sesión OCR / Imágenes
7. **Tickets fallando en Android** → fotos de 8-15 MB superaban límites → `compress-image.ts`
8. **Fotos giradas 90° en Android** → `createImageBitmap({ imageOrientation: "from-image" })`
9. **Doble toast en `handleFileSelected`** → unificado en un solo try/catch
10. **Validaciones tras compresión inútiles** → movidas ANTES de comprimir

### Sesión actual (junio 2026) 🆕
11. **OCR caído con 500 en producción** → el modelo `claude-sonnet-4-20250514` fue retirado por Anthropic el 15/06/2026 y devolvía `404 not_found_error` (`x-should-retry: false`). **Solución:** migrar a `claude-haiku-4-5`. **Diagnóstico engañoso:** parecía timeout, pero el `catch` genérico enterró el 404 en un 500.
12. **Errores de OCR sin granularidad** → route reescrito para distinguir 404 / 429-529 / resto.
13. **SharePoint nuevo daba `accessDenied` en Graph Explorer** → pista falsa: Graph Explorer usa permisos delegados (usuario), no los de la app. La app sí accedía (verificado con `test-sharepoint.mjs`).
14. **Migración apuntaría a sitio/biblioteca equivocados** → la carpeta destino está en la biblioteca `Contabilidad` (no la de por defecto); requería `getDriveId` + `SHAREPOINT_LIBRARY_NAME`.
15. **Nombre de variable desalineado** → el `.env` tenía `SHAREPOINT_BASE_PATH`, pero el código lee `SHAREPOINT_FOLDER_PATH` → caía al valor por defecto sin avisar.
16. **Año duplicado en la ruta de SharePoint** → reestructurado para que `Año {yyyy}` salga del ticket y se cree solo cada año.

---

## 🔑 VARIABLES DE ENTORNO CRÍTICAS

```env
# Database
DATABASE_URL=postgresql://...

# BetterAuth + Microsoft OAuth
BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=https://ticket-app-opal-rho.vercel.app
BETTER_AUTH_CLIENT_ID=...
BETTER_AUTH_CLIENT_SECRET=...

# Anthropic (OCR)
ANTHROPIC_API_KEY=sk-ant-...

# Cloudinary
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# Microsoft Graph (SharePoint)  🆕 ACTUALIZADO
MICROSOFT_TENANT_ID=...        # sin cambios
MICROSOFT_CLIENT_ID=...        # sin cambios (mismo que BetterAuth)
MICROSOFT_CLIENT_SECRET=...    # sin cambios

# Sitio nuevo: Financiero y Contabilidad (host,siteCollectionId,webId)
MICROSOFT_SITE_ID=fintegra2001.sharepoint.com,d49fb16d-756a-4169-a09a-b1d353760e77,cb90855b-590b-4046-bde3-5b9a5aa76822

# Biblioteca de documentos (NO la de por defecto) y carpeta base relativa
SHAREPOINT_LIBRARY_NAME=Contabilidad
SHAREPOINT_FOLDER_PATH=/Facturas General

# ⚠️ SHAREPOINT_BASE_PATH quedó OBSOLETA → eliminar (el código no la lee)
```
> Recordatorio: actualizar estas variables también en **Vercel** y hacer redeploy (no se propagan solas).

---

## 📐 PATRONES CRÍTICOS

### 1. Trip Assignment Check
```typescript
// ✅ nested include
assignedUsers: { include: { user: { select: { id, name, email } } } }
// ❌ select directo causa errores
```

### 2. Admin vs User Routes
```typescript
useAdminTrip(tripId)  // /api/admin/trips/:id
useTrip(tripId)       // /api/trips/:id (con ownership)
```

### 3. Query Invalidation — invalidar AMBAS caches
```typescript
queryClient.invalidateQueries({ queryKey: ["trips"] })
queryClient.invalidateQueries({ queryKey: ["adminTrips"] })
```

### 4. Service Worker — qué NO cachear
```javascript
if (url.pathname.startsWith('/api/')) return;
if (url.pathname.startsWith('/api/auth')) return;
if (url.pathname.startsWith('/_next/webpack-hmr')) return;
```

### 5. Compresión client-side ANTES de upload
```typescript
// ✅ validar primero, comprimir después
if (!file.type.startsWith("image/")) return;
if (file.size > 25 * 1024 * 1024) return;
const compressed = await compressImage(file);
```

### 6. Next.js 16: viewport va aparte de metadata
```typescript
export const viewport: Viewport = { themeColor: "#2563eb" }
```

### 7. 🆕 Modelo de Anthropic como constante + alias sin fecha
```typescript
const OCR_MODEL = "claude-haiku-4-5"; // no string fechado en prod
```

### 8. 🆕 SharePoint: biblioteca no-default vía driveId
```typescript
// /sites/{id}/drive    → SOLO la biblioteca por defecto
// /sites/{id}/drives   → lista todas; busca por name y usa /drives/{driveId}/...
```

---

## 🚀 COMANDOS ÚTILES

```bash
# Desarrollo (SW desactivado automáticamente)
pnpm dev

# Build producción (activa SW)
pnpm build && pnpm start

# Prisma
npx prisma migrate dev
npx prisma generate
npx prisma studio

# Test PWA local con HTTPS (requerido para SW)
ngrok http 3000

# 🆕 Diagnóstico de acceso a SharePoint (permisos de aplicación)
node --env-file=.env test-sharepoint.mjs
```

---

## 📊 MÉTRICAS ACTUALES

- **OCR modelo:** 🆕 Haiku 4.5 (`claude-haiku-4-5`)
- **Coste OCR:** 🆕 ~$0.09 USD/mes (120 imágenes) — antes ~$1/mes con Sonnet
- **Cloudinary:** Dentro del free tier (25GB)
- **SharePoint:** 🆕 Conectado a `FinancieroyContabilidad` → biblioteca `Contabilidad`
- **Vercel Hobby:** Fluid Compute habilitado (hasta 300s disponibles; no fijado)
- **PWA:** Instalable en iOS y Android ✅
- **Usuarios:** 2 roles (USER, ADMIN)
- **URL producción:** https://ticket-app-opal-rho.vercel.app

---

## 🎯 MEJORAS FUTURAS POSIBLES

### Opcionales surgidas esta sesión
1. **Retry en cliente acotado** (`hooks/useOCR.ts`) — solo para saturación (status 503 / `retryable: true` que ya devuelve el route), con backoff + jitter y 1-2 intentos, **nunca** en 4xx/404. El SDK ya reintenta el salto Vercel↔Anthropic; esto cubriría solo el salto móvil↔Vercel. **No urgente** (el fallo real era el modelo, no la red).
2. **Structured outputs** (GA en Haiku 4.5) — eliminar el hack `replace(/```json/)` y garantizar JSON válido por contrato.
3. **Aviso de nueva versión PWA** — `skipWaiting()` + `clients.claim()` o toast "recargar" (solo relevante al cambiar lógica del SW).

### Roadmap general
4. **Upload directo a Cloudinary** (signed uploads) — saltarse Vercel para imágenes grandes
5. **Background Sync** — cola offline de gastos pendientes
6. **Push Notifications** — avisar al USER en cambios de status
7. **Share Target API** — compartir foto desde galería a la app
8. **Automigración a SharePoint** — cron job mensual
9. **Validación de NIF/CIF** — regex formato español
10. **Bulk operations** — aprobar/rechazar múltiples trips
11. **Multi-nivel approval** — manager → finance → admin
12. **Budget tracking** — límites por proyecto/usuario
13. **Mobile app nativa** — React Native con misma API

---

## 📦 DEPENDENCIAS PRINCIPALES

```json
{
  "@anthropic-ai/sdk": "^0.x",
  "@microsoft/microsoft-graph-client": "^3.x",
  "@prisma/client": "^5.x",
  "@tanstack/react-query": "^5.x",
  "better-auth": "^1.x",
  "cloudinary": "^2.x",
  "exceljs": "^4.x",
  "next": "16.x",
  "prisma": "^5.x",
  "react": "^19.x",
  "sonner": "^1.x",
  "zod": "^3.x"
}
```

**Notas:**
- No usa `next-pwa` ni `workbox` → SW custom
- No usa `browser-image-compression` → utilidad propia con Canvas API
- Sin dependencias añadidas en esta sesión

---

## 📝 NOTAS PARA LA PRÓXIMA SESIÓN

### Estado al cerrar
- ✅ OCR operativo de nuevo (Haiku 4.5) tras la retirada del modelo Sonnet 4
- ✅ Route de OCR endurecido (errores tipados, parse seguro)
- ✅ `description` retirado del OCR (decisión de negocio)
- ✅ SharePoint reconfigurado a `FinancieroyContabilidad` / `Contabilidad` (acceso de app verificado)
- ⏳ Aplicar en `.env` + Vercel las nuevas variables (`SITE_ID`, `SHAREPOINT_LIBRARY_NAME`, `SHAREPOINT_FOLDER_PATH`) y borrar `SHAREPOINT_BASE_PATH`
- ⏳ Aplicar el cambio de `folderPath` (año) en `migrate-to-sharepoint/route.ts`
- ⏳ Probar "Verificar conexión" en /profile y migrar UN mes de prueba (vigilar acento de "Año" y espacio de "Facturas General")
- ⏳ Eliminar la línea de `description` del prompt en `ocr/route.ts` (lo hace el usuario a mano)

### Si vienen reportes de OCR fallando
1. Mirar el **status real** en logs de Vercel (ya no se enmascara): 404 = modelo/config; 503/429/529 = saturación; 502 = JSON inválido.
2. Si es saturación recurrente → aplicar el retry acotado en cliente.

### Convención a fijar con financiero
- Carpetas de año en SharePoint: EXACTAMENTE `Año 2026`, `Año 2027`... (misma grafía).

### Archivos tocados/creados esta sesión
- `app/api/expenses/ocr/route.ts` — modelo Haiku 4.5 + endurecimiento
- `app/api/admin/migrate-to-sharepoint/route.ts` — reestructura del `folderPath` (año)
- `lib/microsoft-graph.ts` — `getDriveId` + `getBasePath` (biblioteca no-default)
- `.env` / Vercel — variables de Graph actualizadas
- `test-sharepoint.mjs` — script diagnóstico (raíz del proyecto)

---

**Última actualización:** Sesión OCR (modelo retirado) + SharePoint nuevo destino (junio 2026)
**Versión:** 3.0.0
**Status:** ✅ Production Ready + PWA + OCR Haiku 4.5 + SharePoint → Financiero/Contabilidad
