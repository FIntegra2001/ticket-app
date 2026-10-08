import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Rutas accesibles sin sesión
const PUBLIC_PATHS = ["/auth", "/api/auth"]
// Pantalla para cuentas aún no aprobadas
const PENDING_PATH = "/pendiente"

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isApi = pathname.startsWith("/api")

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next()
  }

  const session = await auth.api.getSession({
    headers: request.headers,
  })

  // Sin sesión → login (o 401 en la API)
  if (!session) {
    return isApi
      ? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      : NextResponse.redirect(new URL("/auth", request.url))
  }

  // Cuenta PENDIENTE o BLOQUEADA → solo puede ver la pantalla de espera
  if (session.user.status !== "ACTIVO") {
    if (pathname === PENDING_PATH) return NextResponse.next()
    return isApi
      ? NextResponse.json({ error: "Cuenta pendiente de aprobación" }, { status: 403 })
      : NextResponse.redirect(new URL(PENDING_PATH, request.url))
  }

  if (pathname === PENDING_PATH) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  // Zona de administración: solo ADMIN
  const isAdminArea =
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname.startsWith("/api/admin")
  if (isAdminArea && session.user.role !== "ADMIN") {
    return isApi
      ? NextResponse.json({ error: "Forbidden" }, { status: 403 })
      : NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Todo salvo internos de Next y ficheros estáticos de public/ (llevan extensión)
    "/((?!_next|.*\\..*).*)",
  ],
}
