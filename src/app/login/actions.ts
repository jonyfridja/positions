"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, createSessionToken } from "@/lib/auth";

export async function login(_prev: string | undefined, formData: FormData) {
  const password = formData.get("password");
  const expected = process.env.APP_PASSWORD;
  const secret = process.env.AUTH_SECRET ?? "";

  if (!expected) return "Server is missing APP_PASSWORD configuration.";
  if (typeof password !== "string" || password !== expected) {
    return "Incorrect password.";
  }

  const token = await createSessionToken(secret);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  redirect("/");
}

export async function logout() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
}
