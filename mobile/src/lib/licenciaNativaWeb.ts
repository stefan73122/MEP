import { WebPlugin } from "@capacitor/core";
import type { LicenciaNativaPlugin } from "./licenciaNativa";

// Implementación SOLO para desarrollo en el navegador (`next dev`): esta
// rama de código no se empaqueta en el APK (que usa siempre la
// implementación nativa Android), así que no hace falta ocultar nada acá —
// es únicamente para poder probar la pantalla de activación sin un
// dispositivo. Tiene que reconstruir la MISMA fórmula que el plugin nativo
// y que licencias/generador-de-claves.html.
const PALABRA_SECRETA_SOLO_PARA_PROBAR_EN_NAVEGADOR = "YELD31-V9B56E-WCEBZS-LKC993-AJB1EW";

async function sha256Hex(texto: string): Promise<string> {
  const datos = new TextEncoder().encode(texto);
  const hashBuffer = await crypto.subtle.digest("SHA-256", datos);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export class LicenciaNativaWeb extends WebPlugin implements LicenciaNativaPlugin {
  async validarClave(opciones: { codigoDispositivo: string; clave: string }): Promise<{ valida: boolean }> {
    if (!opciones.codigoDispositivo) return { valida: false };
    const hash = await sha256Hex(opciones.codigoDispositivo + PALABRA_SECRETA_SOLO_PARA_PROBAR_EN_NAVEGADOR);
    const esperada = (hash.slice(0, 16).toUpperCase().match(/.{1,4}/g) ?? []).join("-");
    const normalizada = opciones.clave.trim().toUpperCase().replace(/\s+/g, "");
    return { valida: normalizada === esperada };
  }

  async verificarFirma(): Promise<{ valida: boolean }> {
    // No hay APK ni firma que comprobar corriendo en el navegador.
    return { valida: true };
  }
}
