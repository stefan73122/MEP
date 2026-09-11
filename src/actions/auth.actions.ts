"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { crearCookieSesion, eliminarCookieSesion, verificarPin } from "@/lib/auth";
import { ingresarPinSchema } from "@/validations/auth.schema";

export type EstadoLogin = { error?: string };

export async function ingresarConPinAction(
  _estadoPrevio: EstadoLogin,
  formData: FormData,
): Promise<EstadoLogin> {
  const resultado = ingresarPinSchema.safeParse(Object.fromEntries(formData));
  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const configuracion = await db.configuracion.findFirst();
  if (!configuracion?.pinHash) {
    // El PIN se desactivó mientras se mostraba esta pantalla: no hace falta validar nada.
    redirect("/");
  }

  const pinValido = await verificarPin(resultado.data.pin, configuracion.pinHash);
  if (!pinValido) {
    return { error: "PIN incorrecto" };
  }

  await crearCookieSesion();
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await eliminarCookieSesion();
  redirect("/login");
}
