import { db } from "@/lib/db/client";
import { requireAcceso, hashPin } from "@/lib/auth";
import {
  actualizarConfiguracionSchema,
  configurarPinSchema,
} from "@/validations/configuracion.schema";
import type { Configuracion } from "@/lib/db/types";

export type EstadoConfiguracion = { error?: string; exito?: boolean };

// Nota: toda escritura tiene que pasar por db.$transaction, incluso un
// update de un solo campo. En web, solo $transaction guarda los cambios en
// el store de IndexedDB (ver persistirCambios en lib/db/sqlite.ts); una
// escritura fuera de una transacción se pierde al recargar la página.
async function obtenerOCrearConfiguracion(): Promise<Configuracion> {
  const existente = await db.configuracion.findFirst();
  if (existente) return existente;
  return db.$transaction((tx) => tx.configuracion.create({ nombreNegocio: "MIP" }));
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
    await db.$transaction((tx) =>
      tx.configuracion.update(configuracion.id, { nombreNegocio, moneda, simboloMoneda, diasAlertaVencimiento }),
    );
  } catch {
    return { error: "No se pudo guardar la configuración. Intentá de nuevo." };
  }

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
    await db.$transaction((tx) => tx.configuracion.update(configuracion.id, { pinHash }));
  } catch {
    return { error: "No se pudo guardar el PIN. Intentá de nuevo." };
  }

  return { exito: true };
}

export async function quitarPin(): Promise<void> {
  await requireAcceso();

  const configuracion = await obtenerOCrearConfiguracion();
  // Sin PIN no hay alternativa de desbloqueo, así que el bloqueo y la huella
  // (que dependen de él como respaldo) dejan de tener sentido y se apagan.
  await db.$transaction((tx) =>
    tx.configuracion.update(configuracion.id, { pinHash: null, bloqueoActivado: false, huellaActivada: false }),
  );
}

export async function activarBloqueo(): Promise<EstadoConfiguracion> {
  await requireAcceso();

  const configuracion = await obtenerOCrearConfiguracion();
  if (!configuracion.pinHash) {
    return { error: "Primero definí un PIN." };
  }

  await db.$transaction((tx) => tx.configuracion.update(configuracion.id, { bloqueoActivado: true }));
  return { exito: true };
}

export async function desactivarBloqueo(): Promise<void> {
  await requireAcceso();

  const configuracion = await obtenerOCrearConfiguracion();
  // La huella es solo un atajo para el bloqueo: si el bloqueo se apaga, no
  // tiene sentido dejarla marcada como activa.
  await db.$transaction((tx) =>
    tx.configuracion.update(configuracion.id, { bloqueoActivado: false, huellaActivada: false }),
  );
}

export async function activarHuella(): Promise<void> {
  await requireAcceso();

  const configuracion = await obtenerOCrearConfiguracion();
  await db.$transaction((tx) => tx.configuracion.update(configuracion.id, { huellaActivada: true }));
}

export async function desactivarHuella(): Promise<void> {
  await requireAcceso();

  const configuracion = await obtenerOCrearConfiguracion();
  await db.$transaction((tx) => tx.configuracion.update(configuracion.id, { huellaActivada: false }));
}
