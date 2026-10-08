"use server";

import { redirect } from "next/navigation";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export const signInSocial = async (provider: "microsoft") => {
  const { url } = await auth.api.signInSocial({
    body: {
      provider,
      callbackURL: "/",
    },
  });

  if (url) {
    redirect(url);
  }
};

export const signOut = async () => {
  const result = await auth.api.signOut({
    headers: await headers()
  });
  return result;
};
