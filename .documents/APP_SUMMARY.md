# 📊 RESUMEN EJECUTIVO - APP DE GESTIÓN DE GASTOS DE VIAJE

## 🎯 Propósito
Sistema full-stack para gestionar gastos de viaje empresarial con OCR automático, validación de administrador y exportación contable.

---

## 🏗️ ARQUITECTURA TÉCNICA

### Stack
- **Frontend:** Next.js 16 (App Router), React, TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** Next.js API Routes
- **Base de datos:** Neon PostgreSQL + Prisma ORM
- **Autenticación:** BetterAuth (roles: USER, ADMIN)
- **OCR:** Claude Sonnet 4.5 (Anthropic API) - ~$1/mes para 120 imágenes
- **Storage:** Cloudinary (plan free: 25GB)
- **Migración:** Microsoft Graph API → SharePoint
- **Export:** ExcelJS (35 columnas contables)

### Idioma
- **Español** - toda la UI y mensajes

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
   - Sube foto del ticket
   - OCR automático extrae:
     * vendor, amount, date
     * invoiceNumber (NIF/CIF del proveedor)
     * category (sugiere categoría)
     * description
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
- `/profile` - Perfil del usuario

### Admin:
- `/admin` - Tabla de TODOS los viajes (paginación clásica, 15/página, filtros)
- `/admin/alltrips` - Cards con CRUD (infinite scroll)
- `/admin/trips/[tripId]/expenses` - Ver/editar/eliminar gastos (delete directo, sin confirmación)
- `/admin/dashboard` - Estadísticas globales (gastos por usuario, por categoría, etc.)
- `/profile` - Incluye sección de migración a SharePoint

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

### Admin Routes (sin restricciones):
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
### Input: Foto del ticket
### Output:
```json
{
  "vendor": "Nombre del establecimiento",
  "amount": 45.50,
  "date": "2026-03-12",
  "invoiceNumber": "B87654321",  // NIF/CIF del proveedor
  "category": "Comida",
  "description": "Menú del día x2"
}
```

### Categorías reconocidas:
- Taxi, Comida, Hotel, Metrobus/Parking, Gasolina, Ave, Avion, ComidasOficina

### Costes estimados:
- 120 imágenes/mes = **~$1.03 USD/mes** (Sonnet 4)
- Alternativa: Haiku 4 = **~$0.09 USD/mes**

---

## 📁 CLOUDINARY → SHAREPOINT

### Estructura en Cloudinary:
```
tickets/
  2026/
    03/
      FAC-2024-001/  ← numberInvoice del trip
        1773231259782_ticket.jpg
        1773231312446_recibo.jpg
```

### Migración a SharePoint:
- **Manual:** Botón en profile page (solo ADMIN)
- **Flujo:**
  1. Selecciona año/mes
  2. Click "Migrar a SharePoint"
  3. Descarga de Cloudinary
  4. Upload a SharePoint (mantiene estructura)
  5. Muestra resultado: X éxitos, Y errores
  6. Archivos permanecen en Cloudinary (cleanup manual)

### Configuración:
```env
MICROSOFT_TENANT_ID=...
MICROSOFT_CLIENT_ID=...
MICROSOFT_CLIENT_SECRET=...
MICROSOFT_SITE_ID=fintegra2001.sharepoint.com,3329ff4f...
SHAREPOINT_BASE_PATH=/TICKETS_CLOUDINARY
```

---

## 📊 EXCEL EXPORT (35 COLUMNAS)

### Columnas principales:
1. fecha
2. MÉTODO DE PAGO (Santander tarj debito, Efectivo, Transferencia, Domiciliacion)
3. CUENTA (GASTOS DE VIAJE, FUNCIONAMIENTO OFICINA)
4. CONCEPTO, SUBCONCEPTO
5. EUROS, IVA, IMPORTE IVA, IMPORTE_TOTAL
6. subcuenta contabilidad (códigos: 62900000006, etc.)
7. PROVEEDOR
8. **NIF/CIF** (del proveedor - `expense.invoiceNumber`)
9. **Nº FACTURA** (interno financiero - `trip.numberInvoice`)
10. COMENTARIOS (Gastos de viaje {ciudad} {fechas} {usuarios} {proyecto})
11. MES, Cobro, mes imputacion, IMPUTACION
12. PROYECTO, PERSONAL, CIUDAD
13. ... otros campos contables

### Mapeos especiales:
```typescript
SUBCUENTAS_CONTABILIDAD = {
  Taxi: "62900000006",
  Comida: "62900000024",
  Hotel: "62900000039",
  ComidasOficina: "62900000022",
  // ...
}

BANCOS = {
  Tarjeta: "Santander tarj debito",
  Efectivo: "Efectivo",
  Transferencia: "Santander transferencia",
  Domiciliacion: "Santander domiciliacion"
}
```

### Diferencias:
- **Admin Excel:** Todos los viajes
- **User Excel:** Solo viajes asignados

---

## 🎨 UI/UX PATTERNS

### Infinite Scroll:
- Cards: 9 inicial, +6 por scroll
- Hook: `useInfiniteQuery` (React Query)

### Paginación Clásica:
- Tabla admin: 15 items/página
- Controles: Anterior/Siguiente + número de página

### Forms:
- **TripForm:** Ciudad (Select), fechas, proyecto, usuarios (multi-select badges), numberInvoice
- **ExpenseForm:** OCR scan, campos auto-rellenados, validación Zod

### TripCard (dual mode):
```tsx
// Admin mode
<TripCard trip={trip} isAdmin={true} />
// → Botones: Ver gastos, Editar, Eliminar, Cambiar status

// User mode  
<TripCard trip={trip} isAdmin={false} />
// → Botón: Ver gastos (readonly)
```

### Toasts:
- Sonner para feedback
- Ejemplos: "Ticket procesado correctamente", "Viaje actualizado"

---

## 🔒 PERMISOS Y SEGURIDAD

### Matriz de permisos:
| Acción | USER | ADMIN |
|--------|------|-------|
| Crear trip | ❌ | ✅ |
| Ver trips | ✅ (asignados) | ✅ (todos) |
| Editar/Eliminar trip | ❌ | ✅ |
| Cambiar status | ❌ | ✅ |
| Crear/Editar/Eliminar expense | ✅ (trips asignados) | ✅ (cualquier trip) |
| Export Excel | ✅ (propio) | ✅ (completo) |
| Migrar a SharePoint | ❌ | ✅ |

### API Security:
- BetterAuth session check en todas las rutas
- User routes: verifican `assignedUsers.some(userId)`
- Admin routes: verifican `role === "ADMIN"`

---

## 🚀 HOOKS ARCHITECTURE

### useTrips (User):
```typescript
useTrips()          // Infinite query (9+6)
useTrip(tripId)     // Single trip
useTripStats()      // Dashboard stats
useUpdateTrip()     // User can update trip details
useExportUserExcel() // /api/trips/export
```

### useAdminTrips (Admin):
```typescript
useAdminTrips()          // Infinite query para cards
useAdminTripsTable(p,l)  // Paginación clásica
useAdminTrip(tripId)     // /api/admin/trips/:id
useAdminTripStats()      // All trips dashboard
useCreateTrip()          // POST /api/trips
useUpdateTrip()          // PUT /api/admin/trips/:id ← uses admin route
useDeleteTrip()          // DELETE /api/admin/trips/:id
useUpdateTripStatus()    // PUT /api/admin/trips/:id/status
useExportExcel()         // Full export
```

### useExpenses:
```typescript
useExpenses(tripId)
useCreateExpense()
useUpdateExpense()
useDeleteExpense()

// IMPORTANT: Every mutation invalidates BOTH user AND admin queries
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

### useOCR:
```typescript
const ocrMutation = useOCR()
const uploadMutation = useUploadReceipt()

// Workflow:
1. ocrData = await ocrMutation.mutateAsync(imageFile)
2. imageUrl = await uploadMutation.mutateAsync({ image, tripId })
3. Auto-fill form with extracted data
```

---

## 📦 COMPONENTES CLAVE

### TripCard.tsx (wrapper pattern):
```tsx
// Dual rendering based on role
isAdmin ? <AdminTripCard /> : <UserTripCard />

// AdminTripCard: Full CRUD + status change
// UserTripCard: Readonly, only "Ver gastos" button
```

### ExpenseForm.tsx:
- Drag/drop o click para subir ticket
- Preview de imagen
- OCR procesamiento con loader
- Auto-fill de campos
- Validación con Zod
- Labels especiales:
  * "NIF/CIF" (no "Nº Factura")
  * "MÉTODO DE PAGO" con 4 opciones Santander

### SharePointMigration.tsx:
- Verificar conexión (GET /api/admin/migrate-to-sharepoint)
- Selector año/mes
- Botón "Migrar a SharePoint"
- Progress + resultados detallados
- Cards con stats: Total, Exitosos, Errores

---

## 🐛 BUGS RESUELTOS

### 1. numberInvoice no se guardaba:
**Causa:** API routes no incluían el campo
**Fix:** Añadido en POST /api/trips y PUT /api/admin/trips/[tripId]

### 2. Excel columnas desordenadas:
**Causa:** ExcelJS con objetos tiene orden impredecible
**Fix:** Usar arrays en lugar de objetos:
```typescript
// ❌ Antes
worksheet.addRow({ fecha: "...", banco: "..." })

// ✅ Ahora
worksheet.addRow([
  formatDate(expense.date),  // posición 0
  BANCOS[method],            // posición 1
  // ...
])
```

### 3. Hydration errors:
**Fix:** `suppressHydrationWarning` en html/body + ClientOnly wrapper

### 4. Cloudinary upload con tripId difícil de reconocer:
**Fix:** Usar `trip.numberInvoice` para nombre de carpeta

---

## 🔑 VARIABLES DE ENTORNO CRÍTICAS

```env
# Database
DATABASE_URL=postgresql://...

# BetterAuth + Microsoft OAuth
BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=http://localhost:3000
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
MICROSOFT_CLIENT_ID=...  # Mismo que BetterAuth
MICROSOFT_CLIENT_SECRET=...  # Mismo que BetterAuth
MICROSOFT_SITE_ID=fintegra2001.sharepoint.com,3329ff4f...
SHAREPOINT_BASE_PATH=/TICKETS_CLOUDINARY
```

---

## 📐 PATRONES CRÍTICOS

### 1. Trip Assignment Check:
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

### 2. Admin vs User Routes:
```typescript
// Admin route - uses /api/admin/trips/:id
const { data } = useAdminTrip(tripId)

// User route - uses /api/trips/:id (with ownership check)
const { data } = useTrip(tripId)
```

### 3. Query Invalidation:
```typescript
// Always invalidate BOTH user and admin caches
queryClient.invalidateQueries({ queryKey: ["trips"] })
queryClient.invalidateQueries({ queryKey: ["adminTrips"] })
```

---

## 🎯 MEJORAS FUTURAS POSIBLES

1. **Automigración a SharePoint:** Cron job mensual
2. **Notificaciones:** Email cuando trip cambia a APROBADO/RECHAZADO
3. **Validación de NIF/CIF:** Formato español (regex)
4. **Bulk operations:** Aprobar/rechazar múltiples trips
5. **Analytics:** Gráficos de tendencias de gastos
6. **Mobile app:** React Native con misma API
7. **Approval workflow:** Multi-nivel (manager → finance → admin)
8. **Receipt validation:** Comparar OCR amount vs manual input
9. **Budget tracking:** Límites por proyecto/usuario
10. **Haiku migration:** Reducir costes de OCR 12x

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

---

## 🚀 COMANDOS ÚTILES

```bash
# Desarrollo
npm run dev

# Prisma
npx prisma migrate dev
npx prisma generate
npx prisma studio

# Build producción
npm run build
npm start
```

---

## 📊 MÉTRICAS ACTUALES (Febrero 2026)

- **OCR tokens:** 57K input, 3K output
- **Coste OCR:** $0.22 USD
- **Cloudinary:** Dentro del free tier (25GB)
- **SharePoint:** Conectado y funcionando
- **Usuarios:** 2 roles (USER, ADMIN)
- **Estado:** ✅ En producción

---

**Última actualización:** 12 Marzo 2026
**Versión:** 1.0.0
**Status:** ✅ Production Ready
