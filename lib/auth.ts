import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "./db";
import { nextCookies } from "better-auth/next-js";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  // Fase 0: el acceso es solo con cuenta Microsoft (ni alta ni login con
  // contraseña).
  emailAndPassword: {
    enabled: false,
  },
  socialProviders: {
    microsoft: {
      clientId: process.env.MICROSOFT_CLIENT_ID as string,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET as string,
      tenantId: process.env.MICROSOFT_TENANT_ID as string,
      prompt: "select_account",
    },
  },
  // Usuarios que antes entraban con contraseña: al entrar con Microsoft (mismo
  // email) se vincula su cuenta en vez de rechazar el acceso. Seguro porque
  // Microsoft solo admite cuentas del tenant de la fundación.
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["microsoft"],
    },
  },
  plugins: [nextCookies()],
  user: {
    additionalFields: {
      role: {
        type: "string",
        input: false,
      },
      status: {
        type: "string",
        input: false,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        // Toda cuenta nueva queda PENDIENTE hasta que un ADMIN la apruebe
        // desde /admin/users.
        before: async (user) => ({
          data: { ...user, status: "PENDIENTE", role: "USER" },
        }),
      },
    },
  },
});
