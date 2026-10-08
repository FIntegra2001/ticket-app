"use client";

import { signOut } from "@/actions/auth-actions";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export function SignOutButton() {
  const router = useRouter();
  return (
    <Button
      variant="outline"
      className="w-full"
      onClick={async () => {
        await signOut();
        router.push("/auth");
        router.refresh();
      }}
    >
      Cerrar sesión
    </Button>
  );
}
