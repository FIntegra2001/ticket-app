# 📊 RESUMEN EJECUTIVO - APP DE GESTIÓN DE GASTOS

> **Versión:** 5.0.0
> **Última actualización:** Aprobación de viajes + documentos + gastos de oficina (29-sep-2026)
> **Status:** ✅ En producción + PWA + OCR Haiku 4.5 + SharePoint + **dos flujos: viajes (con aprobación) y gastos de oficina**

---

## 🆕 CAMBIOS DE ESTA SESIÓN (v4.1 → v5.0)

Seis bloques, implementados y verificados por fases. **Nada commiteado** (trabajo en el árbol).

### 1. Confirmación de borrado
Los 4 botones de eliminar (viaje y gasto, en vista user y admin) borraban al primer click, sin confirmación y **sin ningún toast**: la fila desaparecía y punto.
- `components/ui/alert-dialog.tsx` — escrito a mano espejando `dialog.tsx`, importando del paquete unificado `radix-ui@1.4.3`. ⚠️ **No usar `npx shadcn add`**: instalaría `@radix-ui/react-alert-dialog` por separado y rompería la convención del repo.
- `components/ui/confirm-delete-dialog.tsx` — wrapper reutilizable.
- ⚠️ **El trigger usa `stopPropagation`, NO `preventDefault`.** Radix compone los handlers con `checkForDefaultPrevented`: un `preventDefault` impediría que el diálogo se abriera. Con `stopPropagation` el clic no llega al `<Link>` que cubre la TripCard y el diálogo sí se abre. Está comentado en el componente para que no se "corrija" de vuelta.
- Toasts de éxito/error en los tres hooks de borrado.

### 2. Flujo de solicitud y aprobación de viajes
Antes el ADMIN creaba el viaje y `TripStatus` era decorativo. Ahora:
- **USER** solicita → `PENDIENTE`, autoasignado, `requestedById` puesto. Card apagada, **sin poder cargar gastos**, con "Editar" y "Retirar solicitud".
- **ADMIN** ve las solicitudes en un bloque ámbar arriba de `/admin` (`components/admin/PendingTripRequests.tsx`), completa lo que falte (nº de factura, asignados) y aprueba o rechaza.
- **APROBADO** desbloquea la carga de gastos. Se sella `approvedAt` / `approvedById`.
- Un viaje creado por ADMIN nace **directamente en APROBADO**: no hay a quién pedírselo.

**🔒 Dos agujeros de seguridad cerrados en `app/api/trips/[tripId]/route.ts`:**
1. El `PUT` no comprobaba rol y usaba el esquema completo → **un USER asignado podía auto-aprobarse el viaje** y reescribir `totalAmount`. Ahora usa `updateTripRequestSchema` (sin `status`, `totalAmount`, `assignedUserIds` ni `numberInvoice`) y solo si `status === PENDIENTE`.
2. El `DELETE` permitía a cualquier usuario asignado **borrar un viaje aprobado entero y, por cascada, sus gastos**. Ahora solo se puede retirar una solicitud pendiente creada por uno mismo.

Candado también en los gastos: un USER no crea/edita/borra gastos si el viaje no está APROBADO (403). El ADMIN no se bloquea, para poder corregir. Y **guarda en la propia página** de gastos, porque la URL es adivinable aunque la card ya no enlace.

### 3. Documentos del viaje (billete y reserva)
Tabla `TripDocument` (`BILLETE | RESERVA | OTRO`). El ADMIN los sube desde el detalle del viaje; el USER los ve y descarga sin pedirlos por correo.

**Dos hallazgos verificados contra la cuenta real de Cloudinary:**
1. **La entrega de PDF está DESACTIVADA en la cuenta**: un PDF subido como `resource_type: "image"` devuelve **401** — también con URL firmada y con `fl_attachment`. **Solución sin tocar la consola: subirlos como `raw`**, que se entregan con 200. Verificado con un PDF de 2 páginas: vuelve íntegro y conserva `/Count 2`. Por eso `resourceTypeFor()` devuelve `"raw"` para `application/pdf`.
2. **Las URLs de Cloudinary son públicas** — cualquiera con el enlace ve el fichero, sin sesión, y una reserva lleva nombre y datos del viajero. Por eso los documentos **no** se enlazan desde Cloudinary: van por `GET /api/trips/[tripId]/documents/[documentId]/file`, que comprueba sesión y asignación, y de paso reemite el `raw` como `application/pdf` (Cloudinary lo sirve como `octet-stream`, que el navegador descargaría en vez de mostrar).

⚠️ **El módulo está partido en dos a propósito**: `lib/trip-documents.ts` (puro, seguro en cliente) y `lib/trip-documents.server.ts` (habla con Cloudinary). El SDK usa `fs`; importar una sola constante desde un componente cliente hacía fallar el build con `Can't resolve 'fs'`.

**Carpeta: `trip-documents/{año del viaje}/{nºfactura|id}`**, fuera del prefijo `tickets/`. Verificado: el listado que hace la migración (`prefix tickets/2026/09`, `resource_type: image`) devuelve 65 recursos y **ninguno** bajo `trip-documents/`. Doble protección, porque además los PDF van como `raw`.

Al borrar un viaje se destruyen sus ficheros en Cloudinary **antes** de la cascada: si no, quedaban huérfanos para siempre (no se migran a SharePoint ni los barre la limpieza de 3 meses).

### 4. Gastos de oficina
Modelo nuevo `OfficeExpense` (un parte por usuario y mes, `@@unique([userId, year, month])`). `Expense.tripId` pasa a nullable y aparece `officeExpenseId`: un gasto cuelga de un viaje **o** de un parte, nunca de los dos.
- **No pasan por aprobación**: el USER crea el parte y carga tickets. Puede "Cerrar parte" (deja de admitir cambios) y el admin reabrirlo.
- El ADMIN los ve en `/admin/office-expenses` y exporta.
- Tickets a **`office-tickets/{año}/{mes}/{Nombre_Usuario}`** — fuera de `tickets/`, así que **no** entran en la migración a SharePoint. Si financiero los quiere allí, es añadir el segundo prefijo al route de migración. El año/mes salen del **parte**, no de la fecha de subida.

### 5. Ficha del viaje visible + Excel de resumen
- `numberInvoice` en la card de admin y en la tabla del panel (en ámbar si falta), más badges `✓/✗ Billete` y `✓/✗ Reserva`.
- **`GET /api/admin/export/trips-summary`**: una fila por viaje, sin gastos, 18 columnas (ver sección Excel).

### 6. Cosas que salieron por el camino
- **Bug latente en `app/api/admin/export/route.ts`**: hacía `findMany` sobre **todos** los gastos sin filtro. En cuanto existieran gastos de oficina se habrían colado en el Excel de viajes y, con el fallback `?? SUBCUENTAS["Taxi"]`, se habrían imputado como taxi de viaje **en silencio**. Añadido `where: { tripId: { not: null } }`. Lo destapó TypeScript al volverse `tripId` nullable.
- **`lib/trip-status.ts` nuevo**: las etiquetas y variantes de estado estaban duplicadas en **cuatro** `switch` idénticos y el estado se pintaba en crudo ("PENDIENTE"). Centralizado, con `acceptsExpenses()` en un solo sitio.
- Añadida la invalidación de `["tripStats", userId]`, que faltaba en todos los hooks de gastos y dejaba el dashboard del usuario desfasado.

---

## ❗ CORRECCIONES A LA DOCUMENTACIÓN ANTERIOR

Tres cosas que v4 decía mal:

| v4 decía | Realidad |
|---|---|
| DB en Neon **`aws-eu-central-1`** (Frankfurt) | **`us-east-2`** (Ohio). El `.env` lo explica: Neon deprecó Frankfurt y se usó us-east-2. Host: `ep-square-voice-axvyzo58-pooler.c-4.us-east-2.aws.neon.tech` |
| Pendiente: "fijar Vercel Functions en **`fra1`**" | ⚠️ **Sería contraproducente**: con la DB en Ohio, `fra1` haría que las queries cruzasen el Atlántico. La región que toca es **`cle1`** (Cleveland, us-east-2) o `iad1`. |
| Excel de **35 columnas** | **27 columnas**. El commit `52b30b2` las bajó de 35 a 27 y la doc no se actualizó. |

---

## 🏗️ ARQUITECTURA TÉCNICA

### Stack
- **Frontend:** Next.js 16.1.6 (App Router, Turbopack), React 19.2, TypeScript, Tailwind 4, shadcn/ui (paquete unificado `radix-ui`)
- **Backend:** Next.js API Routes sobre Vercel Functions (Fluid Compute)
- **Base de datos:** Neon PostgreSQL (**`us-east-2`, Ohio**) + **Prisma 7** con `@prisma/adapter-pg`
  - Cliente generado en `app/generated/prisma` (TypeScript, versionado)
  - Config en `prisma.config.ts`
- **Autenticación:** BetterAuth (USER/ADMIN) + Microsoft OAuth
- **OCR:** Claude Haiku 4.5 (`claude-haiku-4-5`, alias sin fecha)
- **Storage:** Cloudinary (plan free)
- **Migración:** Microsoft Graph → SharePoint (permisos de **aplicación**)
- **Export:** ExcelJS
- **Deploy:** Vercel Hobby + PWA (service worker propio)

### ⚠️ Cambios de schema: `db push`, NO `migrate`
El historial de migraciones está roto: la única migración (`20260210123244_init`) está en **dialecto SQL Server** y solo crea las tablas de BetterAuth — `trips`, `expenses` y compañía se aplicaron con `db push` y no figuran en el historial.

```bash
npx prisma db push && npx prisma generate
# Para revisar ANTES qué va a aplicar:
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
```
Hacer un baseline del historial sigue siendo deuda pendiente.

---

## 📊 MODELO DE DATOS

```
User
├─ id, name, email, role (USER | ADMIN)
├─ createdTrips / requestedTrips / approvedTrips
└─ officeExpenses

Trip
├─ city, startDate, endDate, project, notes, numberInvoice
├─ status (PENDIENTE | APROBADO | RECHAZADO)
├─ createdByAdminId?   ← nullable: null si lo solicitó un USER
├─ requestedById?      ← 🆕 USER que lo solicitó
├─ approvedAt?, approvedById?   ← 🆕 sello de aprobación
├─ totalAmount (incremental, nunca recalculado por agregación)
├─ assignedUsers[] (TripAssignment)
├─ expenses[]
└─ documents[] (TripDocument)   ← 🆕

TripDocument   🆕
├─ tripId, type (BILLETE | RESERVA | OTRO)
├─ url, publicId, fileName, mimeType, size
└─ uploadedById

OfficeExpense   🆕  (@@unique([userId, year, month]))
├─ userId, year, month, title?, notes?
├─ status (ABIERTO | CERRADO)
├─ totalAmount
└─ expenses[]

Expense
├─ tripId?          ← 🆕 nullable
├─ officeExpenseId? ← 🆕 exactamente uno de los dos (lo garantizan las rutas,
│                      Prisma no puede expresarlo)
├─ date, amount, category?, vendor?, description?
├─ invoiceNumber (NIF/CIF del proveedor), receiptUrl, paymentMethod
└─ createdByAdminId?
```

---

## 🏷️ CATEGORÍAS — `lib/expense-categories.ts`

### La regla de oro (ampliada)
> Una categoría se declara **una** vez. Y ahora tiene **`scope`**: cada contexto ve solo sus categorías. Es lo que impide imputar un taxi de oficina (`62900000019`) a la cuenta de taxi de viaje (`62900000006`).

**15 categorías: 7 de viaje + 8 de oficina.**

| value | label | subcuenta | scope |
|---|---|---|---|
| `Taxi` | Taxi | 62900000006 | trip |
| `Comida` | Comida | 62900000024 | trip |
| `Hotel` | Hotel | 62900000039 | trip |
| `Metrobus/Parking` | Metrobus/Parking | 62900000045 | trip |
| `Gasolina` | Gasolina | 62900000031 | trip |
| `Ave` | Ave | 62900000025 | trip |
| `Avion` | Avion | 62900000038 | trip |
| `Limpieza` 🆕 | Limpieza | 62900000012 | office |
| `Mensajeria` 🆕 | mensajeria | 62400000000 | office |
| `TaxiOficina` | Taxi | 62900000019 | office |
| `ParkingOficina` | parking o metrobus | 62900000008 | office |
| `GasolinaOficina` | gasolina | 62900000029 | office |
| `Material` 🆕 | Material | 62900000001 | office |
| `ComidasOficina` | comidas | 62900000022 | office |
| `Regalos` 🆕 | Regalos | 62900000036 | office |

> ⚠️ **`ComidasOficina` ya NO sale en el select de viajes** (antes figuraba ahí con el label "Escuela Formación"). Por eso viaje tiene 7 opciones y no 8. Los gastos históricos que la tengan **siguen exportando bien**: `SUBCUENTAS` conserva la entrada.
> ⚠️ **Grafía exacta de financiero**, minúsculas incluidas (`mensajeria` sin tilde, `parking oficina-metrobus`, `gasolina oficina`). **Pendiente de confirmar con financiero** el `subconcepto` de las 4 nuevas: se ha usado literalmente el texto que dieron.

### Derivados
`SUBCUENTAS`, `SUBCUENTAS_CONTABILIDAD` (todas, para el histórico), `TRIP_CATEGORIES`, `OFFICE_CATEGORIES`, `getCategoriesByScope(scope)`, `getOcrCategories(scope)`, `isValidCategory`, **`isValidCategoryForScope(value, scope)`**.

**Verificado con un script de comprobación**: las 8 subcuentas de oficina mapean al código correcto, las 15 son únicas, `scope office` rechaza `"Taxi"`, `scope trip` rechaza `"TaxiOficina"`, y el OCR de oficina no ofrece categorías de viaje.

### Añadir una categoría
Una fila en el array, con su `scope`. Nada más — `Expense.category` es `String?`, sin migración.

---

## 🤖 OCR

`POST /api/expenses/ocr` acepta **`scope`** (`"trip"` por defecto, retrocompatible):
- El prompt se construye con `getOcrCategories(scope)` y con las pistas de `CATEGORY_HINTS[scope]`.
- La whitelist post-parse valida con `isValidCategoryForScope(..., scope)`; si falla → `category = ""` y la elige el usuario.

**Por qué las de oficina ahora sí son sugeribles:** el motivo original de `ocr: false` era que un ticket de taxi no dice si el viaje era de empresa o de oficina. Dentro de un **parte de oficina** el contexto ya lo resuelve: ese taxi *es* de oficina. La ambigüedad desaparece con el scope.

---

## 📁 CLOUDINARY — TRES ÁRBOLES, Y LA DIFERENCIA IMPORTA

| Prefijo | Qué | ¿Va a SharePoint? |
|---|---|---|
| `tickets/{año}/{mes}/{nºfactura}` | Tickets de gasto de **viaje** | **Sí** — es el único prefijo que recorre la migración |
| `office-tickets/{año}/{mes}/{Nombre_Usuario}` | Tickets de gasto de **oficina** | No |
| `trip-documents/{año}/{nºfactura}` | **Billetes y reservas** | No — y tampoco debe barrerlos la limpieza de 3 meses: son la única copia |

⚠️ La migración usa `cloudinary.api.resources({ prefix, resource_type: "image" })`: limitada a **500 resultados sin paginar** (deuda ya conocida) y ciega a los `raw`.

---

## 📊 EXCEL — TRES EXPORTS DE GASTOS + UNO DE RESUMEN

### 27 columnas (gastos)
`fecha` · `MÉTODO DE PAGO` · `CONCEPTO` · `SUBCONCEPTO` · `Nª Registro` · `EUROS` · `IVA` · `IMPORTE IVA` · `IMPORTE_TOTAL` · `subcuenta contabildad` · `PROVEEDOR` · `NIF/CIF` · `Nº FACTURA` · `COMENTARIOS` · `MES` · `Cobro` · `mes imputacion` · `IMPUTACION` · `PROYECTO` · `Pagado` · `Fecha Pago` · `PERSONAL` · `PPTO` · `Nº noches` · `Nº pax viajan` · `Nº trayectos` · `CIUDAD`

> Typos preservados a propósito: `Nª Registro` (ordinal femenino) y `subcuenta contabildad` (sin la "i").

| Export | Ruta | IVA_RATE |
|---|---|---|
| Gastos de viaje (admin) | `/api/admin/export` | **0** |
| Gastos de viaje (usuario) | `/api/trips/export` | **0.21** ⚠️ |
| Gastos de oficina (ambos) 🆕 | `/api/admin/office-expenses/export` y `/api/office-expenses/export` | **0**, en un solo sitio |

### ⚠️ DEUDA VIVA: `IVA_RATE` divergente en los exports de VIAJE
El mismo gasto de viaje se exporta con base e IVA distintos según quién descargue. **Sigue abierto, pendiente de financiero.** Hay un `TODO` en ambos archivos.

Los dos exports de **oficina** no heredan el problema: comparten el generador `lib/office-expenses-export.ts`, así que quien cambie una columna o el IVA lo cambia para los dos. Los de viaje se escribieron por separado y han divergido también en `Nº FACTURA`, `COMENTARIOS` y anchos de columna.

### 🆕 Resumen de viajes — `/api/admin/export/trips-summary`
Una fila por viaje, **sin gastos**. Hoja "Resumen Viajes", cabecera congelada.
`Nº FACTURA` · `CIUDAD` · `PROYECTO` · `ESTADO` · `ORIGEN` (Usuario/Admin) · `SOLICITADO POR` · `FECHA SOLICITUD` · `FECHA APROBACIÓN` · `APROBADO POR` · `FECHA INICIO` · `FECHA FIN` · `Nº NOCHES` · `PERSONAL` · `BILLETE` · `RESERVA HOTEL` · `Nº GASTOS` · `TOTAL` · `NOTAS`

> `Nº NOCHES` = días entre fin e inicio. Ida y vuelta el mismo día = **0 noches**. Confirmar con financiero si lo cuentan así.

---

## 🔌 API ROUTES

### Viajes
```
GET/POST        /api/trips                 # POST: ADMIN crea aprobado, USER solicita
GET/PUT/DELETE  /api/trips/[tripId]        # PUT/DELETE solo sobre solicitud PENDIENTE propia
GET/POST        /api/trips/[tripId]/expenses          # 403 si no está APROBADO (USER)
PUT/DELETE      /api/trips/[tripId]/expenses/[id]     # idem
GET             /api/trips/[tripId]/documents         🆕
GET             /api/trips/[tripId]/documents/[id]/file  🆕 sirve el fichero con sesión
GET             /api/trips/stats · /api/trips/export
```

### Admin
```
GET             /api/admin/trips?status=          # 🆕 filtro
GET/PUT/DELETE  /api/admin/trips/[tripId]
PUT             /api/admin/trips/[tripId]/status  # 🆕 sella approvedAt + 404 si no existe
POST            /api/admin/trips/[tripId]/documents        🆕
DELETE          /api/admin/trips/[tripId]/documents/[id]   🆕
GET             /api/admin/export                 # gastos de viaje (solo tripId != null)
GET             /api/admin/export/trips-summary   🆕
GET             /api/admin/office-expenses        🆕
GET             /api/admin/office-expenses/export 🆕
GET/POST        /api/admin/migrate-to-sharepoint
```

### Gastos de oficina 🆕
```
GET/POST        /api/office-expenses
GET/PUT/DELETE  /api/office-expenses/[officeExpenseId]
GET/POST        /api/office-expenses/[officeExpenseId]/expenses
PUT/DELETE      /api/office-expenses/[officeExpenseId]/expenses/[expenseId]
GET             /api/office-expenses/export
```

### Utilidades
```
POST /api/expenses/ocr             # 🆕 acepta `scope`
POST /api/expenses/upload-receipt  # 🆕 acepta `tripId` O `officeExpenseId`
```

---

## 🎨 PÁGINAS

### Usuario
- `/trips` — viajes y solicitudes. 🆕 "Solicitar viaje"
- `/trips/[tripId]/expenses` — 🆕 documentos arriba; candado si no está aprobado
- `/office-expenses` 🆕 — partes de gastos de oficina
- `/office-expenses/[id]` 🆕 — gastos del parte
- `/dashboard`, `/profile`

### Admin
- `/admin` — 🆕 solicitudes pendientes arriba, Nº Factura y Docs. en la tabla, dos exports
- `/admin/alltrips` — cards con CRUD
- `/admin/trips/[tripId]/expenses` — 🆕 subir/borrar documentos
- `/admin/office-expenses` 🆕
- `/admin/dashboard`, `/profile`

---

## 🔒 PERMISOS

| Acción | USER | ADMIN |
|--------|------|-------|
| Solicitar viaje | ✅ 🆕 | ✅ (nace aprobado) |
| Editar/retirar su solicitud PENDIENTE | ✅ 🆕 | ✅ |
| Editar/borrar viaje aprobado | ❌ 🆕 | ✅ |
| Aprobar/rechazar | ❌ | ✅ |
| Cargar gastos de viaje | ✅ solo si APROBADO 🆕 | ✅ siempre |
| Ver/descargar documentos | ✅ (asignado) | ✅ |
| Subir/borrar documentos | ❌ | ✅ |
| Crear parte de oficina y cargar gastos | ✅ sin aprobación 🆕 | ✅ |
| Cerrar/reabrir parte | ✅ propio | ✅ cualquiera |
| Exportar | ✅ propio | ✅ todo |

---

## 📐 PATRONES CRÍTICOS

1. **Single source of truth.** Categorías (`expense-categories.ts`), estados (`trip-status.ts`), meses y títulos de parte (`office-expenses.ts`), generador del Excel de oficina (`office-expenses-export.ts`). Si un dato de negocio se escribe a mano en dos sitios, **divergirá sin que nadie lo note** — ya pasó con `IVA_RATE` y con los cuatro `switch` de estado.
2. **Errores silenciosos > errores ruidosos (peligro).** Un `?? SUBCUENTAS["Taxi"]` no falla nunca: contabiliza mal y te enteras meses después. El export de oficina **no** replica ese fallback: prefiere la celda vacía.
3. **Validar la categoría contra el scope**, no solo contra la lista completa.
4. **Radix + `<Link>` superpuesto** → `stopPropagation`, nunca `preventDefault`.
5. **Módulos que tocan el SDK de Cloudinary → `.server.ts`.** Usa `fs`; si un componente cliente lo importa (aunque sea una constante), el build falla.
6. **Modelo de Anthropic como constante y alias sin fecha.**
7. **SharePoint: biblioteca no-default vía `driveId`.**
8. **Prefijos de Cloudinary como contrato.** Lo que se mete bajo `tickets/` acaba en SharePoint. Lo que no, no.
9. Next.js 16: `viewport` va aparte de `metadata`.

---

## 📝 NOTAS PARA LA PRÓXIMA SESIÓN

### Estado al cerrar (29-sep-2026)
- ✅ Las 6 fases implementadas; `pnpm build` y `pnpm lint` limpios (queda 1 warning preexistente: `files` sin usar en `migrate-to-sharepoint`).
- ✅ Schema aplicado en Neon con `db push`; backfill de `approvedAt` ejecutado (56/56 viajes).
- ⚠️ **Nada commiteado.** El trabajo está sin commitear en el árbol, rama `improve-flow-and-adds` (46 ficheros entre modificados y nuevos, sin contar `app/generated/prisma`).

### Pendientes
1. **`IVA_RATE` divergente en los dos exports de VIAJE** (0 admin / 0,21 usuario) → decisión de financiero. La deuda más importante.
2. **Confirmar con financiero** el `subconcepto` exacto de `Limpieza`, `Mensajeria`, `Material` y `Regalos`, y que `ComidasOficina` desaparezca del select de viajes.
3. **Plan de Cloudinary sin implementar**: tabla `MigrationLog`, limpieza de >3 meses.
   - 📍 Ese documento **no está en la rama `improve-flow-and-adds`**: vive en el commit `e6630ef` de `sharepoint-directly`. Para traerlo:
     `git checkout sharepoint-directly -- .documents/PLAN_log-migracion-y-limpieza-cloudinary.md`
   - ⚠️ **Cuando se implemente, la limpieza solo puede barrer `tickets/`.** `office-tickets/` y `trip-documents/` NO se migran a SharePoint, así que Cloudinary es su **única copia**. La comprobación "borrar solo lo confirmado en SP" ya los protege por sí sola (nunca estarán en SP), pero conviene filtrar el listado por `prefix: "tickets/"` para no gastar llamadas ni engordar el informe de "saltados".
4. **Región de Vercel Functions**: si se toca, `cle1`/`iad1` — **no `fra1`** (la DB está en Ohio).
5. Baseline del historial de migraciones de Prisma.
6. `@db.Decimal(12,2)` en los `Decimal` (hoy `DECIMAL(65,30)`).
7. `uploadReceiptImage` de `lib/cloudinary.ts` es **código muerto** confirmado (cero llamadas en el repo) y su estructura `receipts/...` es incompatible con la migración. Se puede borrar.
8. Menor: el export de admin de gastos sigue generando fichero/hoja "Mis Gastos" aunque contenga los gastos de todos.

### Ficheros nuevos de esta sesión
```
components/ui/alert-dialog.tsx · components/ui/confirm-delete-dialog.tsx
components/admin/PendingTripRequests.tsx · components/trips/TripDocuments.tsx
lib/trip-status.ts · lib/trip-documents.ts · lib/trip-documents.server.ts
lib/office-expenses.ts · lib/office-expenses-export.ts
hooks/useTripDocuments.ts · hooks/useOfficeExpenses.ts
app/api/trips/[tripId]/documents/** · app/api/admin/trips/[tripId]/documents/**
app/api/office-expenses/** · app/api/admin/office-expenses/**
app/api/admin/export/trips-summary/route.ts
app/(protected)/office-expenses/** · app/(protected)/admin/office-expenses/**
```

---

**Versión:** 5.0.0
**Status:** ✅ Production Ready · dos flujos (viajes con aprobación + oficina) · documentos del viaje · 15 categorías con scope
