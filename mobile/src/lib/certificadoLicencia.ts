// Verificación del certificado de licencia (JWT ES256 que firma la Edge
// Function "licencia" de Supabase). Sin dependencias de Capacitor ni de
// React a propósito: es lógica pura, y así se puede probar desde Node contra
// los certificados reales del servidor (ver scripts/probar-ingreso.ts).

export type DatosCertificado = {
  iss: "mip-licencias";
  /** Id del usuario en Supabase Auth. */
  sub: string;
  email: string | null;
  /** Id de la licencia. */
  lic: string;
  /** Código del dispositivo para el que se emitió. */
  disp: string;
  /** Emitido (segundos epoch, hora del servidor). */
  iat: number;
  /** Válido sin conexión hasta (segundos epoch). */
  exp: number;
  /** Vencimiento de la licencia (segundos epoch) o null si no vence. */
  vlic: number | null;
};

export type EstadoCertificado = "valido" | "otro_dispositivo" | "reloj_atrasado" | "vencido";

// Cuánto puede ir el reloj del teléfono "para atrás" sin que se sospeche que
// lo atrasaron a mano para estirar un certificado vencido. Holgado para no
// molestar a nadie por correcciones normales de hora.
export const TOLERANCIA_RELOJ_MS = 24 * 60 * 60 * 1000;

function bytesDeBase64url(texto: string): Uint8Array<ArrayBuffer> {
  const base64 = texto.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(texto.length / 4) * 4, "=");
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

function jsonDeBase64url(texto: string): unknown {
  return JSON.parse(new TextDecoder().decode(bytesDeBase64url(texto)));
}

function esDatosCertificado(valor: unknown): valor is DatosCertificado {
  if (typeof valor !== "object" || valor === null) return false;
  const d = valor as Record<string, unknown>;
  return (
    d.iss === "mip-licencias" &&
    typeof d.sub === "string" &&
    typeof d.lic === "string" &&
    typeof d.disp === "string" &&
    (d.email === null || typeof d.email === "string") &&
    Number.isInteger(d.iat) &&
    Number.isInteger(d.exp) &&
    (d.vlic === null || Number.isInteger(d.vlic))
  );
}

// Devuelve los datos solo si la firma es auténtica (hecha con una de las
// claves privadas cuyas públicas se aceptan); si no, null. No mira fechas ni
// dispositivo: eso lo hace evaluarCertificado().
export async function verificarCertificado(
  certificado: string,
  clavesPublicas: Record<string, JsonWebKey>,
): Promise<DatosCertificado | null> {
  const partes = certificado.split(".");
  if (partes.length !== 3) return null;
  const [encabezadoB64, cuerpoB64, firmaB64] = partes;

  try {
    const encabezado = jsonDeBase64url(encabezadoB64) as { alg?: unknown; kid?: unknown };
    if (encabezado.alg !== "ES256" || typeof encabezado.kid !== "string") return null;
    // hasOwnProperty y no Object.hasOwn: este último no existe en los
    // WebView de Android más viejos.
    const jwk = Object.prototype.hasOwnProperty.call(clavesPublicas, encabezado.kid)
      ? clavesPublicas[encabezado.kid]
      : undefined;
    if (!jwk) return null;

    const clave = await crypto.subtle.importKey(
      "jwk",
      { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y },
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    const firmaValida = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      clave,
      bytesDeBase64url(firmaB64),
      new TextEncoder().encode(`${encabezadoB64}.${cuerpoB64}`),
    );
    if (!firmaValida) return null;

    const datos = jsonDeBase64url(cuerpoB64);
    return esDatosCertificado(datos) ? datos : null;
  } catch {
    return null;
  }
}

// `maximaFechaVistaMs`: la hora más avanzada que la app ya vio en este
// teléfono (se guarda en cada uso). Si el reloj marca bastante menos, alguien
// lo atrasó: se exige conectarse para renovar, que trae la hora del servidor.
export function evaluarCertificado(
  datos: DatosCertificado,
  codigoDispositivo: string,
  ahoraMs: number,
  maximaFechaVistaMs: number,
): EstadoCertificado {
  if (datos.disp !== codigoDispositivo) return "otro_dispositivo";
  if (ahoraMs + TOLERANCIA_RELOJ_MS < datos.iat * 1000) return "reloj_atrasado";
  if (ahoraMs + TOLERANCIA_RELOJ_MS < maximaFechaVistaMs) return "reloj_atrasado";
  if (ahoraMs >= datos.exp * 1000) return "vencido";
  return "valido";
}
