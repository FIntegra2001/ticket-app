import type React from "react";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { User, UserRole } from "@/types";
import { UserProvider } from "@/context/userContext";
import Navigation from "@/components/Navigation";
import { Toaster } from "sonner";
import { QueryProvider } from "@/providers/QueryProvider";
import { ServiceWorkerRegister } from "@/components/service-worker-register";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Ticketing App",
    template: "%s | Ticketing App",
  },
  description: "Control de gastos en viajes",
  applicationName: "Ticketing App",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Ticketing App",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      {
        url: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

// En Next.js 16, themeColor y viewport van en un export separado
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#2563eb" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover", // para iPhones con notch
};

const isValidUserRole = (role: string | undefined | null): role is UserRole => {
  if (typeof role !== "string") return false;
  return ["USER", "ADMIN"].includes(role as UserRole);
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  let currentUser: User | null = null;

  // Un usuario PENDIENTE/BLOQUEADO no ve navegación (solo la pantalla /pendiente)
  if (session?.user && session.user.status === "ACTIVO") {
    const sessionUserRole = session.user.role;

    if (isValidUserRole(sessionUserRole)) {
      currentUser = {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: sessionUserRole,
      };
    } else {
      console.warn(
        `[Auth Warning] Rol inválido o ausente recibido para el usuario ${session.user.id}: '${sessionUserRole}'. Estableciendo usuario como null o rol por defecto si aplicable.`
      );
    }
  }

  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="antialiased" suppressHydrationWarning>
        <UserProvider initialUser={currentUser}>
          <QueryProvider>
            <Navigation />
            {children}
          </QueryProvider>
        </UserProvider>
        <Toaster position="bottom-center" richColors />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}