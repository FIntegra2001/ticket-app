"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createAuthClient } from "better-auth/client";

// Fase 0: el acceso es solo con cuenta Microsoft de la fundación. Las cuentas
// nuevas quedan pendientes hasta que un administrador las aprueba.
export default function AuthClientPage() {
  const [isLoading, setIsLoading] = useState(false);
  const authClient = createAuthClient();

  const signInMicrosoft = async () => {
    setIsLoading(true);
    try {
      await authClient.signIn.social({
        provider: "microsoft",
        callbackURL: "/",
      });
    } catch {
      toast.error("No se pudo iniciar sesión con Microsoft");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-red-50 to-indigo-100">
      <div className="flex items-center justify-center p-4 pt-20">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Bienvenido</h1>
            <p className="text-gray-600">
              Inicia sesión con tu cuenta de Fundación Integra
            </p>
          </div>

          <button
            onClick={signInMicrosoft}
            disabled={isLoading}
            className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg shadow-sm bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg
              className="w-6 h-6 mr-2"
              viewBox="0 0 23 23"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect x="0" y="0" width="10" height="10" fill="#F25022" />
              <rect x="13" y="0" width="10" height="10" fill="#7FBA00" />
              <rect x="0" y="13" width="10" height="10" fill="#00A4EF" />
              <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
            </svg>
            {isLoading ? "Redirigiendo..." : "Continuar con Microsoft"}
          </button>

          <p className="text-center text-sm text-gray-500">
            Si es tu primer acceso, un administrador tendrá que aprobar tu cuenta.
          </p>
        </div>
      </div>
    </div>
  );
}
