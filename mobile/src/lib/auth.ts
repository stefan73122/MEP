import bcrypt from "bcryptjs";
import { App } from "@capacitor/app";
import { db } from "./db/client";

const SALT_ROUNDS = 10;

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, SALT_ROUNDS);
}

export async function verificarPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}

// Sin servidor ni cookies: el desbloqueo es solo una marca en memoria, nunca
// se guarda en disco. Se pierde al recargar la app y, a propósito, cada vez
// que la app pasa a segundo plano (ver registrarRebloqueoAlPausar): es una
// app de plata, no corresponde dar margen de gracia como con una sesión
// de días.
let desbloqueado = false;

export function marcarDesbloqueado(): void {
  desbloqueado = true;
}

export function bloquear(): void {
  desbloqueado = false;
}

let listenerRegistrado = false;

// Se llama una sola vez, desde AuthGate (que vive mientras dura la sesión
// del tablero): así, sin importar en qué pantalla haya quedado la app,
// volver de segundo plano siempre exige desbloquear de nuevo.
export function registrarRebloqueoAlPausar(): void {
  if (listenerRegistrado) return;
  listenerRegistrado = true;
  App.addListener("pause", () => bloquear());
}

// Sistema de un solo usuario: el bloqueo es opcional. Si está desactivado
// (o no hay PIN configurado, lo que lo vuelve inutilizable), se entra
// directo. Si está activo, hace falta haberse desbloqueado en esta misma
// sesión de primer plano (ver marcarDesbloqueado/bloquear).
export async function tieneAcceso(): Promise<boolean> {
  const configuracion = await db.configuracion.findFirst();
  if (!configuracion?.bloqueoActivado || !configuracion.pinHash) return true;
  return desbloqueado;
}

export class ErrorAccesoDenegado extends Error {
  constructor() {
    super("No autorizado");
    this.name = "ErrorAccesoDenegado";
  }
}

// A diferencia de la versión con Server Actions, acá no se puede redirigir
// desde dentro de una acción: esto es solo una segunda comprobación (la
// primera y principal es AuthGate, que ya bloquea el acceso a las páginas).
export async function requireAcceso(): Promise<void> {
  if (!(await tieneAcceso())) {
    throw new ErrorAccesoDenegado();
  }
}
