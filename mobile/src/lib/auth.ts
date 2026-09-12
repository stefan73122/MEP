import bcrypt from "bcryptjs";
import { Preferences } from "@capacitor/preferences";
import { db } from "./db/client";
import { DURACION_SESION_MS } from "./constants";

const SALT_ROUNDS = 10;
const CLAVE_SESION = "sesionExpiraEn";

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, SALT_ROUNDS);
}

export async function verificarPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}

export async function pinConfigurado(): Promise<boolean> {
  const configuracion = await db.configuracion.findFirst();
  return !!configuracion?.pinHash;
}

// Sin cookies ni servidor: la sesión es solo una marca de tiempo guardada en
// las preferencias nativas del dispositivo (Capacitor Preferences).
export async function crearSesion(): Promise<void> {
  const expira = Date.now() + DURACION_SESION_MS;
  await Preferences.set({ key: CLAVE_SESION, value: String(expira) });
}

export async function eliminarSesion(): Promise<void> {
  await Preferences.remove({ key: CLAVE_SESION });
}

async function haySesionVigente(): Promise<boolean> {
  const { value } = await Preferences.get({ key: CLAVE_SESION });
  if (!value) return false;
  const expira = Number(value);
  return Number.isFinite(expira) && expira > Date.now();
}

// Sistema de un solo usuario: si no hay PIN configurado, se entra directo.
// Si hay PIN, hace falta una sesión vigente (ver crearSesion/AuthGate).
export async function tieneAcceso(): Promise<boolean> {
  if (!(await pinConfigurado())) return true;
  return haySesionVigente();
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
