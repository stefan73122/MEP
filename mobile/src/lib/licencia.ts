import { Device } from "@capacitor/device";
import { db } from "./db/client";

// ============================================================================
// ⚠️ PALABRA SECRETA DE ACTIVACIÓN ⚠️
// Tiene que ser IDÉNTICA a la de "licencias/generador-de-claves.html"
// (fuera de este proyecto de código, sin subir a git). Si se cambia acá sin
// cambiarla también ahí, las claves que genere esa página dejan de servir.
const PALABRA_SECRETA = "MIP-2026-LLAVE-SECRETA-DE-ACTIVACION";
// ============================================================================

async function sha256Hex(texto: string): Promise<string> {
  const datos = new TextEncoder().encode(texto);
  const hashBuffer = await crypto.subtle.digest("SHA-256", datos);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function agruparDeACuatro(codigo: string): string {
  return (codigo.match(/.{1,4}/g) ?? [codigo]).join("-");
}

// Código de dispositivo: derivado del identificador único que Android le
// asigna a esta app en este teléfono (Device.getId() → ANDROID_ID; desde
// Android 8 ese valor ya es distinto por cada combinación app+dispositivo,
// no uno solo por teléfono). No se muestra el identificador crudo (largo y
// en minúsculas, incómodo para dictar o escribir): se deriva de él un código
// corto en mayúsculas, mismo estilo que la clave de activación pero de un
// largo distinto para no confundirlos.
export async function obtenerCodigoDispositivo(): Promise<string> {
  const { identifier } = await Device.getId();
  const hash = await sha256Hex(identifier);
  return agruparDeACuatro(hash.slice(0, 12).toUpperCase());
}

// Misma fórmula, a mano, en "licencias/generador-de-claves.html": código de
// dispositivo + palabra secreta, hash, primeros 16 caracteres en mayúsculas,
// agrupados de a 4.
export async function calcularClaveActivacion(codigoDispositivo: string): Promise<string> {
  const hash = await sha256Hex(codigoDispositivo + PALABRA_SECRETA);
  return agruparDeACuatro(hash.slice(0, 16).toUpperCase());
}

function normalizar(clave: string): string {
  return clave.trim().toUpperCase().replace(/\s+/g, "");
}

export type EstadoLicencia = { activada: boolean; codigoDispositivo: string };

// La licencia queda atada al código de dispositivo con el que se activó: si
// cambia (reinstalación, otro teléfono, etc.), deja de coincidir y vuelve a
// pedir activación aunque la fila de Configuracion siga marcada como activada.
export async function obtenerEstadoLicencia(): Promise<EstadoLicencia> {
  const codigoDispositivo = await obtenerCodigoDispositivo();
  const configuracion = await db.configuracion.findFirst();
  const activada = !!configuracion?.licenciaActivada && configuracion.licenciaCodigoDispositivo === codigoDispositivo;
  return { activada, codigoDispositivo };
}

export async function activarConClave(
  codigoDispositivo: string,
  claveIngresada: string,
): Promise<{ error?: string }> {
  const esperada = await calcularClaveActivacion(codigoDispositivo);
  if (normalizar(claveIngresada) !== esperada) {
    return { error: "Clave incorrecta" };
  }

  const existente = await db.configuracion.findFirst();
  const configuracion = existente ?? (await db.$transaction((tx) => tx.configuracion.create({ nombreNegocio: "MIP" })));
  await db.$transaction((tx) =>
    tx.configuracion.update(configuracion.id, {
      licenciaActivada: true,
      licenciaCodigoDispositivo: codigoDispositivo,
    }),
  );
  return {};
}
