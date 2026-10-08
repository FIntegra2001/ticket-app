import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SignOutButton } from "./sign-out-button";

// Pantalla para cuentas que aún no ha aprobado un administrador (o bloqueadas).
// proxy.ts redirige aquí cualquier petición de un usuario no ACTIVO.
export default async function PendientePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/auth");

  const blocked = session.user.status === "BLOQUEADO";

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">
          {blocked ? "Acceso bloqueado" : "Acceso pendiente de aprobación"}
        </h1>
        <p className="text-gray-600">
          {blocked
            ? "Tu cuenta no tiene acceso a la aplicación. Si crees que es un error, contacta con administración."
            : "Hola " +
              (session.user.name ?? "") +
              ". Tu cuenta se ha registrado correctamente. Un administrador tiene que aprobarla antes de que puedas usar la aplicación. Vuelve a entrar más tarde."}
        </p>
        <p className="text-sm text-gray-500">{session.user.email}</p>
        <SignOutButton />
      </div>
    </div>
  );
}
