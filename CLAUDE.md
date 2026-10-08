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
