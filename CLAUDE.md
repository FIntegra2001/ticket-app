# ticket-app (Fundación Integra) — contexto del proyecto

App de **gastos de viajes y de oficina** (no es un helpdesk: "ticket" = foto de un recibo). Autor original: Nicolás Mendoza (GitHub `nmendozaFI`). Documentación de traspaso más completa: `.documents/APP_SUMMARY_v5.md`.

## Stack
- Next.js 16 (App Router, `proxy.ts` en lugar de middleware), React 19, TypeScript, Tailwind 4, shadcn/radix, TanStack Query, zod 4. PWA (`public/sw.js`).
- Prisma 7 + PostgreSQL (Neon). Cliente generado en `app/generated/prisma` (commiteado).
- better-auth: email/contraseña + Microsoft Entra ID (`lib/auth.ts`).
- Cloudinary (recibos y documentos), Microsoft Graph → SharePoint (migración mensual), Anthropic (OCR de recibos, `app/api/expenses/ocr/route.ts`), ExcelJS (exportaciones).
- Despliegue: Vercel. Gestor de paquetes: pnpm.

## Modelo de datos (`prisma/schema.prisma`)
- `User` (role USER | ADMIN; se asigna directamente en BD).
- `Trip` (status PENDIENTE | APROBADO | RECHAZADO, totalAmount, numberInvoice) ↔ `TripAssignment` ↔ User.
- `TripDocument` (BILLETE | RESERVA | OTRO, en Cloudinary como `raw`).
- `OfficeExpense` (parte mensual por usuario, ABIERTO | CERRADO).
- `Expense` (pertenece a un Trip **o** a un OfficeExpense; categoría validada en `lib/expense-categories.ts`).

## Flujo
1. USER solicita viaje (PENDIENTE) o ADMIN lo crea (APROBADO).
2. ADMIN asigna usuarios, nº de factura y aprueba/rechaza.
3. Usuarios asignados suben recibos (compresión en cliente → Cloudinary `tickets/{año}/{mes}/{factura}`, OCR opcional) solo en viajes APROBADOS.
4. ADMIN adjunta billetes/reservas, exporta a Excel y migra `tickets/AAAA/MM` a SharePoint.
5. Partes de oficina: ABIERTO → CERRADO (ADMIN puede reabrir).

## Comandos
- `pnpm i` · `pnpm dev` · `pnpm build` · `pnpm lint`
- Cambios de esquema: `npx prisma db push && npx prisma generate` (el historial de `migrate` está roto; no usar `migrate`).
- Variables de entorno (`.env`): DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL, MICROSOFT_CLIENT_ID/SECRET/TENANT_ID/SITE_ID, SHAREPOINT_LIBRARY_NAME, SHAREPOINT_FOLDER_PATH, CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET, ANTHROPIC_API_KEY.

## Cosas a tener en cuenta
- `proxy.ts` NO protege `/api/*` ni comprueba rol: cada ruta API debe validar sesión y rol ADMIN.
- No hay tests ni CI.
- IVA inconsistente entre exportaciones (`app/api/admin/export/route.ts` vs `app/api/trips/export/route.ts`).

## Contrato con Facturas Integra (NO ROMPER)
Facturas Integra (github.com/FIntegra2001/facturas-integra) es la app MAESTRA de contabilidad y lee esta BD en SOLO LECTURA (rol Neon `lector_facturas`) para traer liquidaciones (Trip) y gastos (Expense de viajes y de partes de oficina). Nunca escribe aquí.

- **Añadir** campos o tablas: sí. **Renombrar o borrar** cualquiera de estos: no, sin avisar antes a Gabriel.
  - Trip: id, numberInvoice (= nº de liquidación), status (PENDIENTE/APROBADO/RECHAZADO), city, startDate, endDate, project, region, approvedAt, createdAt, updatedAt.
  - TripAssignment (tripId, userId) y User (id, name, email). El viajero real debe quedar siempre asignado al viaje (no usar administracion@ como "usuario de visibilidad").
  - TripStage: tripId, position, cityId/cityOther, delegation, arrivalDate, departureDate.
  - TripProject (tripId, projectId) y Project (code, year).
  - Expense: id, tripId, officeExpenseId, date, amount, category, vendor, description, invoiceNumber, paymentMethod, projectId, delegation, accountingCode, stageId, kmTotal, ratePerKm, receiptUrl.
  - OfficeExpense: id, userId, year, month, status (ABIERTO/CERRADO).
- Valores de `category` (`lib/expense-categories.ts`) y de `paymentMethod` (Tarjeta, Efectivo, Transferencia, Domiciliacion, Bankinter): añadir o renombrar uno → avisar antes. Las etiquetas visibles (p. ej. "Adelanto personal (reembolso)" = Efectivo, "Desayuno EF" = ComidasOficina en viajes) pueden cambiar; el `value` guardado no.

- Campo añadido después del contrato: `Trip.closedAt` / `closedById` = viaje cerrado por administración (el viajero ya no puede tocar sus gastos). El `status` sigue siendo APROBADO; Facturas puede usar `closedAt` para saber qué liquidaciones están validadas.

## Hoja de ruta acordada (todavía NO implementar)
1. Proyectos, ciudades/delegaciones, personas y medios de pago se leerán de Facturas (API de solo lectura con clave). No invertir en mejorar las pantallas de Proyectos/Ciudades de esta app.
2. El dashboard de admin pasará a ser una bandeja de tareas SIN importes agregados (quitar "Gasto total" y "Gasto por usuario"; mantener el importe de tickets de cada viaje para reembolsos). Bandeja: solicitudes pendientes de aprobar, próximos viajes, aprobados sin billete/reserva, viajes pasados con tickets sin subir o sin categorizar, aprobados sin nº de liquidación.
3. Billetes (tren/avión), hotel y gasolina de viaje se contabilizan en Facturas vinculados a la liquidación; aquí se siguen guardando como TripDocument para el viajero.

## Estado actual (noviembre 2026)
- Fases 0-3 en producción: acceso solo Microsoft con aprobación de usuarios (User.status), viajes con tramos (TripStage) y catálogo de ciudades, gastos de oficina con kilometraje y reembolsos, pestañas Solicitudes/Próximos/Realizados, seguimiento de hotel, filtros de exportación, catálogo de proyectos (Project/ProjectAllocation, código contable CÓD-DELEG-AÑO por gasto), resumen de confirmación al guardar un gasto, arrastrar documentos.
- BD de pruebas: rama de Neon `pruebas` en `.env`; producción en `.env.produccion` (no se sube). Los cambios en producción los ejecuta Gabriel con `node scripts/produccion.mjs …`.
- Vercel y Azure están en cuentas de Nicolás: pendiente recuperarlas vía el admin de Microsoft 365.
