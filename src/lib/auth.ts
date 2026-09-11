import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { DURACION_SESION_MS, NOMBRE_COOKIE_SESION } from "./constants";

const SALT_ROUNDS = 10;

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, SALT_ROUNDS);
}

export async function verificarPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}

type SesionPayload = { exp: number };

function getSecreto(): string {
  const secreto = process.env.SESSION_SECRET;
  if (!secreto) {
    throw new Error(
      "Falta la variable de entorno SESSION_SECRET. Definila en el archivo .env",
    );
  }
  return secreto;
}

function base64UrlEncode(valor: string): string {
  return Buffer.from(valor, "utf8").toString("base64url");
}

function base64UrlDecode(valor: string): string {
  return Buffer.from(valor, "base64url").toString("utf8");
}

function firmar(datos: string): string {
  return createHmac("sha256", getSecreto()).update(datos).digest("base64url");
}

// Empaqueta el payload de sesión en un token firmado: "<payload-base64url>.<firma>"
// No requiere tabla en la base de datos: la cookie misma es la fuente de verdad.
function firmarSesion(payload: SesionPayload): string {
  const datos = base64UrlEncode(JSON.stringify(payload));
  const firma = firmar(datos);
  return `${datos}.${firma}`;
}

function verificarSesion(token: string): SesionPayload | null {
  const separador = token.lastIndexOf(".");
  if (separador === -1) return null;

  const datos = token.slice(0, separador);
  const firma = token.slice(separador + 1);
  const firmaEsperada = firmar(datos);

  const bufA = Buffer.from(firma);
  const bufB = Buffer.from(firmaEsperada);
  if (bufA.length !== bufB.length || !timingSafeEqual(bufA, bufB)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(datos)) as SesionPayload;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export async function crearCookieSesion(): Promise<void> {
  const sesion: SesionPayload = { exp: Date.now() + DURACION_SESION_MS };
  const token = firmarSesion(sesion);
  const almacen = await cookies();

  almacen.set(NOMBRE_COOKIE_SESION, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURACION_SESION_MS / 1000,
  });
}

export async function eliminarCookieSesion(): Promise<void> {
  const almacen = await cookies();
  almacen.delete(NOMBRE_COOKIE_SESION);
}

async function haySesionValida(): Promise<boolean> {
  const almacen = await cookies();
  const token = almacen.get(NOMBRE_COOKIE_SESION)?.value;
  if (!token) return false;
  return verificarSesion(token) !== null;
}

export async function pinConfigurado(): Promise<boolean> {
  const configuracion = await db.configuracion.findFirst();
  return !!configuracion?.pinHash;
}

// Sistema de un solo usuario: si no hay PIN configurado, se entra directo.
// Si hay PIN, hace falta una sesión válida (cookie firmada) o redirige a /login.
// Se llama al principio de Server Components, Server Actions y Route Handlers
// que requieren acceso.
export async function requireAcceso(): Promise<void> {
  if (!(await pinConfigurado())) return;

  if (!(await haySesionValida())) {
    redirect("/login");
  }
}
