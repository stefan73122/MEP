"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAcceso, hashPin } from "@/lib/auth";
import {
  actualizarConfiguracionSchema,
  configurarPinSchema,
} from "@/validations/configuracion.schema";

export type EstadoConfiguracion = { error?: string; exito?: boolean };

async function obtenerOCrearConfiguracion() {
  const existente = await db.configuracion.findFirst();
  if (existente) return existente;
  return db.configuracion.create({ data: { nombreNegocio: "Mi Tienda" } });
}

export async function actualizarConfiguracion(
  _estadoPrevio: EstadoConfiguracion,
  formData: FormData,
): Promise<EstadoConfiguracion> {
  await requireAcceso();

  const resultado = actualizarConfiguracionSchema.safeParse(Object.fromEntries(formData));
  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { nombreNegocio, moneda, simboloMoneda, diasAlertaVencimientoTexto } = resultado.data;

  const diasAlertaVencimiento = Number(diasAlertaVencimientoTexto);
  if (!Number.isInteger(diasAlertaVencimiento) || diasAlertaVencimiento < 0) {
    return { error: "Los días de anticipación deben ser un número entero positivo" };
  }

  try {
    const configuracion = await obtenerOCrearConfiguracion();
    await db.configuracion.update({
      where: { id: configuracion.id },
      data: { nombreNegocio, moneda, simboloMoneda, diasAlertaVencimiento },
    });
  } catch {
    return { error: "No se pudo guardar la configuración. Intentá de nuevo." };
  }

  revalidatePath("/configuracion");
  revalidatePath("/", "layout");
  return { exito: true };
}

export async function configurarPin(
  _estadoPrevio: EstadoConfiguracion,
  formData: FormData,
): Promise<EstadoConfiguracion> {
  await requireAcceso();

  const resultado = configurarPinSchema.safeParse(Object.fromEntries(formData));
  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Datos inválidos" };
  }

  try {
    const configuracion = await obtenerOCrearConfiguracion();
    const pinHash = await hashPin(resultado.data.pin);
    await db.configuracion.update({ where: { id: configuracion.id }, data: { pinHash } });
  } catch {
    return { error: "No se pudo guardar el PIN. Intentá de nuevo." };
  }

  revalidatePath("/configuracion");
  return { exito: true };
}

export async function quitarPin(): Promise<void> {
  await requireAcceso();

  const configuracion = await obtenerOCrearConfiguracion();
  await db.configuracion.update({ where: { id: configuracion.id }, data: { pinHash: null } });

  revalidatePath("/configuracion");
}
