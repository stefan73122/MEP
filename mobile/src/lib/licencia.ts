import { Device } from "@capacitor/device";
import { db } from "./db/client";
import LicenciaNativa from "./licenciaNativa";

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
// largo distinto para no confundirlos. Esto no es secreto (se comparte a
// propósito), así que no hace falta que viva en código nativo.
export async function obtenerCodigoDispositivo(): Promise<string> {
  const { identifier } = await Device.getId();
  const hash = await sha256Hex(identifier);
  return agruparDeACuatro(hash.slice(0, 12).toUpperCase());
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

// La validación de la clave (y la palabra secreta) viven en el plugin nativo
// Android — ver android/app/src/main/java/com/mitienda/app/LicenciaPlugin.java.
// Este archivo (JavaScript, empaquetado como texto plano dentro del APK)
// nunca ve la palabra secreta ni la clave correcta: solo manda el código de
// dispositivo y lo que el usuario escribió, y recibe verdadero/falso.
export async function activarConClave(
  codigoDispositivo: string,
  claveIngresada: string,
): Promise<{ error?: string }> {
  const { valida } = await LicenciaNativa.validarClave({
    codigoDispositivo,
    clave: normalizar(claveIngresada),
  });
  if (!valida) {
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

// Comprueba que el APK esté firmado con la firma esperada (embebida en el
// plugin nativo). Si alguien lo modificó y lo volvió a firmar con otra
// clave, esto da falso — ver PantallaAppInvalida.
export async function verificarFirmaValida(): Promise<boolean> {
  const { valida } = await LicenciaNativa.verificarFirma();
  return valida;
}
