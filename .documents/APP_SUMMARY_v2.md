# 📊 RESUMEN EJECUTIVO - APP DE GESTIÓN DE GASTOS DE VIAJE

> **Versión:** 2.0.0
> **Última actualización:** Sesión actual (continuación)
> **Status:** ✅ En producción + PWA + OCR optimizado

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
- **OCR:** Claude Sonnet 4.5 (Anthropic API) - ~$1/mes para 120 imágenes
- **Storage:** Cloudinary (plan free: 25GB)
- **Migración:** Microsoft Graph API → SharePoint
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
│   ├── ImageCapture.tsx    # ✨ Componente extraído (sesión actual)
│   ├── pwa-install-section.tsx    # ✨ PWA
│   ├── service-worker-register.tsx # ✨ PWA
│   └── ui/                 # shadcn components
├── context/
│   └── userContext.tsx
├── hooks/
│   ├── useOCR.ts
│   ├── useTrips.ts
│   ├── useAdminTrips.ts
│   ├── useExpenses.ts
│   └── use-install-prompt.ts  # ✨ PWA
├── lib/
│   ├── auth.ts
│   ├── prisma.ts
│   └── compress-image.ts   # ✨ Compresión cliente (sesión actual)
├── prisma/
├── providers/
│   └── QueryProvider.tsx
├── public/
│   ├── manifest.json       # ✨ PWA
│   ├── sw.js               # ✨ Service Worker
│   ├── favicon.ico
│   └── icons/              # ✨ 4 iconos PWA
│       ├── icon-192x192.png
│       ├── icon-512x512.png
│       ├── icon-maskable-512x512.png
│       └── apple-touch-icon.png
├── types/
└── vercel.json             # ✨ Headers para SW
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
├─ vendor, description, paymentMethod
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
   - Mantiene estructura: `/TICKETS_CLOUDINARY/año/mes/numberInvoice/`

### USER:
1. **Ver viajes asignados:**
   - Solo ve trips donde está en `assignedUsers`
   - Infinite scroll (9 inicial, +6 más)

2. **Crear gastos:**
   - Sube foto del ticket (cámara o galería)
   - **✨ NUEVO: Compresión automática client-side** antes de subir
   - OCR automático extrae: vendor, amount, date, invoiceNumber, category, description
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
- `/profile` - Perfil del usuario + **sección PWA install**

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

### Modelo: `claude-sonnet-4-20250514`
### Input: Foto del ticket (ya comprimida desde el cliente)
### Output:
```json
{
  "vendor": "Nombre del establecimiento",
  "amount": 45.50,
  "date": "2026-03-12",
  "invoiceNumber": "B87654321",
  "category": "Comida",
  "description": "Menú del día x2"
}
```

### Categorías reconocidas:
- Taxi, Comida, Hotel, Metrobus/Parking, Gasolina, Ave, Avion, ComidasOficina

### Costes estimados:
- 120 imágenes/mes = **~$1.03 USD/mes** (Sonnet 4.5)
- Alternativa futura: Haiku 4.5 = **~$0.09 USD/mes** (12x más barato)

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

### Manifest minimalista (4 iconos)
```
public/icons/
├── icon-192x192.png         # Android home screen
├── icon-512x512.png         # Splash screen Android
├── icon-maskable-512x512.png # Adaptive icons Android
└── apple-touch-icon.png     # iOS (180x180)
```

### Hook `useInstallPrompt`
- Detecta `beforeinstallprompt` (Chrome/Edge/Android)
- Detecta `display-mode: standalone` (ya instalada)
- Detecta iOS (Safari no soporta el evento → muestra instrucciones manuales)
- **Lazy initializer** en `useState` para evitar setState síncrono en useEffect

### Sección de instalación en `/profile`
- Android: botón "Instalar aplicación"
- iOS: instrucciones manuales (Compartir → Añadir a pantalla de inicio)
- Detecta cuando ya está instalada → muestra confirmación

### Configuración Vercel
- **`vercel.json`** con headers `Cache-Control: max-age=0` para `/sw.js` y `/manifest.json`
- Evita problemas de cache de CDN al actualizar el SW
- **Fluid Compute** activo por defecto → permite `maxDuration: 300s` incluso en Hobby

---

## 🖼️ COMPRESIÓN DE IMÁGENES (CLIENT-SIDE) ✨ NUEVO

### El problema que resolvía
Móviles Android modernos (Samsung S22+, Pixel 7+) generaban fotos de **8-15 MB** que:
1. Superaban el límite de **4.5 MB** del body de Vercel Functions
2. Superaban el límite de **5 MB** de Claude Vision
3. Tardaban eternidades por 4G débil → timeouts
4. iOS funcionaba porque Safari convierte HEIC→JPEG automáticamente. Android no.

### Solución implementada: `lib/compress-image.ts`
- **100% client-side**, sin dependencias externas (Canvas API nativo)
- **createImageBitmap con `imageOrientation: "from-image"`** → corrige rotación EXIF (Android sacaba fotos giradas 90°)
- Redimensiona a máximo **1600x1600 px** manteniendo aspect ratio
- Comprime a **JPEG calidad 0.85**
- Si el resultado supera **4 MB**, reintenta con calidad progresivamente menor (0.85 → 0.70 → 0.55 → 0.40)
- Si aún así no entra, **reduce dimensiones** como último recurso
- Detecta **HEIC en Android** y muestra error claro (no se puede decodificar nativamente)

### Resultado típico
- 8.5 MB foto Android → **600 KB** JPEG comprimido (93% menos)
- Calidad idéntica para OCR
- Sin pérdida perceptible de información

### Integración en `ExpenseForm.tsx`
```tsx
async function handleFileSelected(file: File) {
  // 1. Validación PREVIA (antes de gastar CPU)
  if (!file.type.startsWith("image/")) {
    toast.error("Por favor selecciona una imagen válida");
    return;
  }
  if (file.size > 25 * 1024 * 1024) {
    toast.error("La imagen es demasiado grande (máx 25MB)");
    return;
  }

  try {
    // 2. Comprimir
    const compressed = await compressImage(file);

    // 3. Preview local inmediato
    const reader = new FileReader();
    reader.onloadend = () => setPreviewUrl(reader.result as string);
    reader.readAsDataURL(compressed);

    // 4. OCR + upload en paralelo
    const [ocrData, imageUrl] = await Promise.all([
      ocrMutation.mutateAsync(compressed),
      uploadMutation.mutateAsync({ image: compressed, tripId }),
    ]);

    // 5. Rellenar campos automáticamente
    setReceiptUrl(imageUrl);
    setValues((prev) => ({ ...prev, ...ocrData, receiptUrl: imageUrl }));
    if (ocrData.amount) setAmountRaw(String(ocrData.amount));

    toast.success("Datos extraídos correctamente. Revisa y confirma.");
  } catch (error) {
    // Mensaje específico para HEIC
    if (error instanceof Error && error.message.includes("HEIC")) {
      toast.error(error.message);
      return;
    }
    toast.error("No se pudo procesar el ticket. Inténtalo nuevamente.");
  }
}
```

---

## 📁 CLOUDINARY → SHAREPOINT

### Estructura en Cloudinary:
```
tickets/
  2026/
    03/
      FAC-2024-001/  ← numberInvoice del trip
        1773231259782_ticket.jpg
```

### Migración a SharePoint:
- **Manual:** Botón en profile page (solo ADMIN)
- **Flujo:** Selecciona año/mes → Click "Migrar" → Descarga de Cloudinary → Upload a SharePoint
- **Configuración:** Variables `MICROSOFT_*` + `SHAREPOINT_BASE_PATH`

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
  Bankinter: "Bankinter"  // ✨ Añadido
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
  - **`ImageCapture`** como componente separado para limpieza de código

### TripCard (dual mode)
```tsx
isAdmin ? <AdminTripCard /> : <UserTripCard />
// Admin: Ver gastos, Editar, Eliminar, Cambiar status
// User: Solo Ver gastos (readonly)
```

### Toasts
- Sonner para feedback: "Ticket procesado correctamente", "Reintentando...", etc.

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

---

## 🚀 HOOKS ARCHITECTURE

### useTrips (User)
```typescript
useTrips()              // Infinite query (9+6)
useTrip(tripId)         // Single trip
useTripStats()
useUpdateTrip()
useExportUserExcel()
```

### useAdminTrips (Admin)
```typescript
useAdminTrips()         // Infinite query para cards
useAdminTripsTable(p,l) // Paginación clásica
useAdminTrip(tripId)
useAdminTripStats()
useCreateTrip()
useUpdateTrip()         // PUT /api/admin/trips/:id
useDeleteTrip()
useUpdateTripStatus()
useExportExcel()
```

### useExpenses
```typescript
useExpenses(tripId)
useCreateExpense()
useUpdateExpense()
useDeleteExpense()

// IMPORTANTE: Toda mutation invalida AMBAS queries
onSuccess: () => {
  queryClient.invalidateQueries(["expenses", tripId])
  queryClient.invalidateQueries(["trip", tripId])
  queryClient.invalidateQueries(["trips", userId])
  queryClient.invalidateQueries(["adminTrip", tripId])
  queryClient.invalidateQueries(["adminTrips"])
  queryClient.invalidateQueries(["adminTripsTable"])
  queryClient.invalidateQueries(["adminTripStats"])
}
```

### useOCR + useUploadReceipt
```typescript
const ocrMutation = useOCR()
const uploadMutation = useUploadReceipt()

// Workflow:
1. compressed = await compressImage(file)    // ✨ Cliente
2. [ocrData, imageUrl] = await Promise.all([  // ✨ Paralelo
     ocrMutation.mutateAsync(compressed),
     uploadMutation.mutateAsync({ image, tripId })
   ])
3. Auto-fill form con datos extraídos
```

### use-install-prompt (PWA) ✨ NUEVO
```typescript
const { state, canInstall, isInstalled, isIOS, promptInstall } = useInstallPrompt()

// Estados: "unsupported" | "available" | "installed" | "ios"
// Lazy initializer en useState para evitar setState síncrono en effect
```

---

## 📦 COMPONENTES CLAVE

### ExpenseForm.tsx
- Validación previa (tipo + tamaño)
- Compresión cliente con `compressImage()`
- OCR + upload en paralelo
- `amountRaw` (string) + `amount` (number) para inputs decimales
- `isSubmitting` con guardia anti doble-tap (timeout 3s)
- Labels especiales:
  - "NIF/CIF" (no "Nº Factura")
  - "MÉTODO DE PAGO" con 5 opciones (Santander tarj débito, Efectivo, Transferencia, Domiciliación, Bankinter)

### ImageCapture.tsx ✨ NUEVO
Componente extraído para limpieza de código. Props: `previewUrl`, `receiptUrl`, `isProcessing`, `onFileSelected`, `onRemove`.

### SharePointMigration.tsx
Verificar conexión, selector año/mes, botón migrar, stats de resultados.

### pwa-install-section.tsx ✨ NUEVO
Card en `/profile` con detección Android/iOS/instalada. Usa `useInstallPrompt`.

### service-worker-register.tsx ✨ NUEVO
Registra `/sw.js` en producción. Detecta updates del SW.

---

## 🐛 BUGS RESUELTOS (HISTÓRICO COMPLETO)

### Sesión inicial
1. **numberInvoice no se guardaba** → faltaba en POST/PUT de API routes
2. **Excel columnas desordenadas** → usar arrays en `addRow` en vez de objetos
3. **Hydration errors** → `suppressHydrationWarning` en html/body + ClientOnly wrapper
4. **Cloudinary tripId difícil** → usar `trip.numberInvoice` para nombre de carpeta

### Sesión PWA
5. **Icono PWA inicial sin display:standalone** → reinstalar tras subir manifest válido
6. **setState síncrono en useEffect** del hook `useInstallPrompt` → resuelto con lazy initializer

### Sesión OCR / Imágenes (actual)
7. **Tickets fallando en Android** → fotos de 8-15 MB superaban límites
   - **Causa:** Vercel Functions tiene límite de 4.5 MB de body
   - **Causa secundaria:** Claude Vision limita a 5 MB por imagen
   - **Solución:** `lib/compress-image.ts` reduce a ~600 KB
8. **Fotos giradas 90° en Android** → fix con `createImageBitmap({ imageOrientation: "from-image" })`
9. **Doble toast / excepciones sueltas en `handleFileSelected`** → unificado en un solo try/catch
10. **Validaciones tras compresión innecesarias** → movidas ANTES de comprimir

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

# Microsoft Graph (SharePoint)
MICROSOFT_TENANT_ID=...
MICROSOFT_CLIENT_ID=...       # Mismo que BetterAuth
MICROSOFT_CLIENT_SECRET=...   # Mismo que BetterAuth
MICROSOFT_SITE_ID=fintegra2001.sharepoint.com,3329ff4f...
SHAREPOINT_BASE_PATH=/TICKETS_CLOUDINARY
```

---

## 📐 PATRONES CRÍTICOS

### 1. Trip Assignment Check
```typescript
// ✅ CORRECT - nested include
assignedUsers: {
  include: {
    user: { select: { id, name, email } }
  }
}

// ❌ WRONG - causes errors
assignedUsers: {
  select: { name, email }
}
```

### 2. Admin vs User Routes
```typescript
const { data } = useAdminTrip(tripId)  // /api/admin/trips/:id
const { data } = useTrip(tripId)       // /api/trips/:id (con ownership)
```

### 3. Query Invalidation
Siempre invalidar AMBAS caches (user y admin):
```typescript
queryClient.invalidateQueries({ queryKey: ["trips"] })
queryClient.invalidateQueries({ queryKey: ["adminTrips"] })
```

### 4. Service Worker — qué NO cachear
```javascript
// NUNCA cachear estas rutas en sw.js:
if (url.pathname.startsWith('/api/')) return;        // OCR, upload, auth
if (url.pathname.startsWith('/api/auth')) return;    // BetterAuth
if (url.pathname.startsWith('/_next/webpack-hmr')) return; // HMR
```

### 5. Compresión client-side ANTES de upload
```typescript
// ✅ CORRECT - validar primero, comprimir después
if (!file.type.startsWith("image/")) return;
if (file.size > 25 * 1024 * 1024) return;
const compressed = await compressImage(file);

// ❌ WRONG - validar tras comprimir es inútil
const compressed = await compressImage(file);
if (compressed.size > 5 * 1024 * 1024) return; // siempre será false
```

### 6. Next.js 16: viewport va aparte de metadata
```typescript
// ✅ CORRECT en Next 14+
export const viewport: Viewport = { themeColor: "#2563eb" }

// ❌ WRONG (deprecated)
export const metadata: Metadata = { themeColor: "#2563eb" }
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
```

---

## 📊 MÉTRICAS ACTUALES

- **OCR tokens (mensuales):** ~57K input, ~3K output
- **Coste OCR:** $0.22-1.00 USD/mes
- **Cloudinary:** Dentro del free tier (25GB)
- **SharePoint:** Conectado y funcionando
- **Vercel Hobby:** Fluid Compute habilitado, `maxDuration: 60s` disponible
- **PWA:** Instalable en iOS y Android ✅
- **Usuarios:** 2 roles (USER, ADMIN)
- **URL producción:** https://ticket-app-opal-rho.vercel.app

---

## 🎯 MEJORAS FUTURAS POSIBLES

### Pendientes de la sesión actual (preparado pero no aplicado)
1. **maxDuration + retry automático en OCR** → quick fix preparado en `/api/expenses/ocr/route.ts` y `hooks/use-ocr.ts` (con backoff exponencial 1s/2s/4s + jitter). **Decisión:** esperar a ver si con la compresión sola se arregla todo. Si no, aplicar este fix.

### Roadmap general
2. **Migrar a Claude Haiku 4.5** — 12x más barato y rápido para OCR
3. **Upload directo a Cloudinary** — saltarse Vercel para imágenes grandes (signed uploads)
4. **Background Sync** — cola offline de gastos pendientes (clave en viajes sin cobertura)
5. **Push Notifications** — avisar al USER cuando trip cambia a APROBADO/RECHAZADO
6. **Share Target API** — compartir foto desde galería directamente a la app
7. **Automigración a SharePoint** — cron job mensual
8. **Validación de NIF/CIF** — formato español (regex)
9. **Bulk operations** — Aprobar/rechazar múltiples trips
10. **Multi-nivel approval** — manager → finance → admin
11. **Budget tracking** — límites por proyecto/usuario
12. **Mobile app nativa** — React Native con misma API

---

## 📚 DEPENDENCIAS PRINCIPALES

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
- Sin dependencias añadidas en sesión actual (todo nativo del navegador)

---

## 📝 NOTAS PARA LA PRÓXIMA SESIÓN

### Estado al cerrar
- ✅ App en producción funcionando
- ✅ PWA instalable y operativa
- ✅ Compresión de imágenes implementada
- ✅ Bug del `handleFileSelected` (doble toast/validación post-compresión) corregido
- ⏳ Pendiente testear en producción con tickets reales de Android
- ⏳ Reserva: aplicar maxDuration + retry si la compresión sola no basta

### Si vienen reportes de OCR fallando tras esta sesión
1. **Primer paso:** revisar si la compresión se aplicó (logs de console del cliente)
2. **Segundo paso:** revisar logs de Vercel — si aparece `FUNCTION_INVOCATION_TIMEOUT` → aplicar el fix de maxDuration
3. **Tercer paso:** considerar migración a Haiku 4.5

### Archivos clave creados en esta sesión
- `lib/compress-image.ts` — utilidad de compresión
- `public/manifest.json` — manifest PWA
- `public/sw.js` — Service Worker
- `public/icons/*.png` — 4 iconos PWA
- `hooks/use-install-prompt.ts` — hook PWA
- `components/pwa-install-section.tsx` — sección /profile
- `components/service-worker-register.tsx` — registro SW
- `vercel.json` — headers cache
- `app/layout.tsx` — metadata + viewport PWA

---

**Última actualización:** Sesión de optimización OCR + PWA (mayo 2026)
**Versión:** 2.0.0
**Status:** ✅ Production Ready + PWA + OCR optimizado
