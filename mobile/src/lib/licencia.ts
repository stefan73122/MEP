import { Device } from "@capacitor/device";
import { Preferences } from "@capacitor/preferences";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { CLAVES_PUBLICAS_LICENCIA, SUPABASE_CLAVE_PUBLICABLE, SUPABASE_URL } from "./backend/config";
import { obtenerSupabase } from "./backend/supabase";
import { evaluarCertificado, verificarCertificado, type DatosCertificado, type EstadoCertificado } from "./certificadoLicencia";
import LicenciaNativa from "./licenciaNativa";

// ============================================================================
// Licencia con cuenta (Supabase)
//
// 1. El cliente inicia sesión con el correo y la contraseña que le dio el
//    administrador (Supabase Auth).
// 2. La app llama a la Edge Function "licencia" con esa sesión: el servidor
//    revisa la licencia (vigente, no suspendida, límite de dispositivos) y
//    devuelve un certificado firmado, atado a este teléfono.
// 3. El certificado se guarda y se verifica SIN conexión con la clave pública
//    (ver certificadoLicencia.ts): la app funciona sin internet hasta que
//    vence (30 días por defecto) y se renueva sola cada vez que hay conexión.
//
// Nada de esto reemplaza al PIN/huella (ver auth.ts): eso es el bloqueo
// rápido del día a día; esto es quién es el cliente y si pagó la licencia.
// ============================================================================

const CLAVE_CERTIFICADO = "mip.licencia.certificado";
const CLAVE_MAXIMA_FECHA_VISTA = "mip.licencia.maximaFechaVista";

const TIEMPO_MAXIMO_RED_MS = 15000;

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
// no uno solo por teléfono). No se muestra el identificador crudo: se deriva
// un código corto en mayúsculas, cómodo para dictarlo. No es secreto: el
// servidor lo usa para contar dispositivos y el certificado queda atado a él.
export async function obtenerCodigoDispositivo(): Promise<string> {
  const { identifier } = await Device.getId();
  const hash = await sha256Hex(identifier);
  return agruparDeACuatro(hash.slice(0, 12).toUpperCase());
}

async function nombreDelDispositivo(): Promise<string | null> {
  try {
    const info = await Device.getInfo();
    const nombre = [info.manufacturer, info.model].filter(Boolean).join(" ").trim();
    return nombre || null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Certificado guardado (sin conexión)
// ---------------------------------------------------------------------------

export type EstadoLicenciaLocal = {
  estado: EstadoCertificado | "ausente" | "invalido";
  datos: DatosCertificado | null;
};

export async function evaluarLicenciaLocal(codigoDispositivo: string): Promise<EstadoLicenciaLocal> {
  const { value: certificado } = await Preferences.get({ key: CLAVE_CERTIFICADO });
  if (!certificado) return { estado: "ausente", datos: null };

  const datos = await verificarCertificado(certificado, CLAVES_PUBLICAS_LICENCIA);
  if (!datos) return { estado: "invalido", datos: null };

  const maximaFechaVista = Number((await Preferences.get({ key: CLAVE_MAXIMA_FECHA_VISTA })).value) || 0;
  const ahora = Date.now();
  const estado = evaluarCertificado(datos, codigoDispositivo, ahora, maximaFechaVista);
  if (estado === "valido" && ahora > maximaFechaVista) {
    await Preferences.set({ key: CLAVE_MAXIMA_FECHA_VISTA, value: String(ahora) });
  }
  return { estado, datos };
}

async function guardarCertificado(certificado: string, datos: DatosCertificado): Promise<void> {
  await Preferences.set({ key: CLAVE_CERTIFICADO, value: certificado });
  // La hora del servidor reemplaza la que se haya visto antes: si el reloj
  // del teléfono estuvo adelantado y ya se corrigió, no queda bloqueado.
  await Preferences.set({ key: CLAVE_MAXIMA_FECHA_VISTA, value: String(datos.iat * 1000) });
}

async function borrarCertificado(): Promise<void> {
  await Preferences.remove({ key: CLAVE_CERTIFICADO });
}

// ---------------------------------------------------------------------------
// Renovación con el servidor
// ---------------------------------------------------------------------------

export type MotivoDenegacion =
  | "sin_licencia"
  | "licencia_suspendida"
  | "licencia_vencida"
  | "limite_dispositivos"
  | "dispositivo_bloqueado"
  | "dispositivo_invalido";

const MOTIVOS_DENEGACION: readonly string[] = [
  "sin_licencia",
  "licencia_suspendida",
  "licencia_vencida",
  "limite_dispositivos",
  "dispositivo_bloqueado",
  "dispositivo_invalido",
];

export type ResultadoRenovacion =
  | { tipo: "ok"; datos: DatosCertificado }
  | { tipo: "denegada"; motivo: MotivoDenegacion; maxDispositivos: number | null; venceEl: string | null }
  | { tipo: "no_autenticado" }
  | { tipo: "sin_conexion" }
  | { tipo: "error"; detalle: string };

// Cada cierre de sesión invalida las renovaciones que estaban en curso: sin
// esto, una respuesta que llega tarde volvería a guardar el certificado de la
// sesión que se acaba de cerrar.
let epocaSesion = 0;

async function llamarFuncionLicencia(token: string, codigoDispositivo: string): Promise<ResultadoRenovacion> {
  const epoca = epocaSesion;
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIEMPO_MAXIMO_RED_MS);
  let respuesta: Response;
  try {
    respuesta = await fetch(`${SUPABASE_URL}/functions/v1/licencia`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_CLAVE_PUBLICABLE,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ codigoDispositivo, nombreDispositivo: await nombreDelDispositivo() }),
      signal: controlador.signal,
    });
  } catch {
    return { tipo: "sin_conexion" };
  } finally {
    clearTimeout(temporizador);
  }

  const cuerpo = (await respuesta.json().catch(() => null)) as Record<string, unknown> | null;

  if (respuesta.status === 401) return { tipo: "no_autenticado" };

  if (respuesta.ok && typeof cuerpo?.certificado === "string") {
    const datos = await verificarCertificado(cuerpo.certificado, CLAVES_PUBLICAS_LICENCIA);
    if (!datos || datos.disp !== codigoDispositivo) {
      // Firmado con una clave que esta versión de la app no conoce: pasa si
      // se rotó la clave del servidor antes de actualizar la app.
      return { tipo: "error", detalle: "El certificado recibido no es válido. Actualiza la app." };
    }
    if (epoca !== epocaSesion) return { tipo: "no_autenticado" };
    await guardarCertificado(cuerpo.certificado, datos);
    return { tipo: "ok", datos };
  }

  if ((respuesta.status === 403 || respuesta.status === 400) && MOTIVOS_DENEGACION.includes(String(cuerpo?.codigo))) {
    // El servidor dijo que no: el certificado guardado deja de valer ya, no
    // cuando venza.
    await borrarCertificado();
    return {
      tipo: "denegada",
      motivo: cuerpo?.codigo as MotivoDenegacion,
      maxDispositivos: typeof cuerpo?.maxDispositivos === "number" ? cuerpo.maxDispositivos : null,
      venceEl: typeof cuerpo?.venceEl === "string" ? cuerpo.venceEl : null,
    };
  }

  return { tipo: "error", detalle: `El servidor respondió con un error (${respuesta.status}).` };
}

// Pide al servidor un certificado nuevo para este teléfono. No lanza
// excepciones: cualquier problema vuelve como un resultado.
export async function renovarLicencia(codigoDispositivo: string): Promise<ResultadoRenovacion> {
  try {
    const supabase = obtenerSupabase();
    // getSession() refresca el token si venció. Un fallo de red al hacerlo
    // NO borra la sesión guardada (sí la borra un refresh rechazado).
    const { data, error } = await supabase.auth.getSession();
    if (error) return isAuthRetryableFetchError(error) ? { tipo: "sin_conexion" } : { tipo: "no_autenticado" };
    if (!data.session) return { tipo: "no_autenticado" };

    const resultado = await llamarFuncionLicencia(data.session.access_token, codigoDispositivo);
    if (resultado.tipo !== "no_autenticado") return resultado;

    // Un 401 con un token que acá parecía vigente suele ser el reloj del
    // teléfono atrasado: se fuerza un refresh (lo decide el servidor) y se
    // reintenta una vez antes de dar la sesión por perdida.
    const refresco = await supabase.auth.refreshSession();
    if (refresco.error) {
      return isAuthRetryableFetchError(refresco.error) ? { tipo: "sin_conexion" } : { tipo: "no_autenticado" };
    }
    if (!refresco.data.session) return { tipo: "no_autenticado" };
    return await llamarFuncionLicencia(refresco.data.session.access_token, codigoDispositivo);
  } catch (error) {
    return { tipo: "error", detalle: error instanceof Error ? error.message : String(error) };
  }
}

// ---------------------------------------------------------------------------
// Sesión
// ---------------------------------------------------------------------------

export async function iniciarSesion(correo: string, contrasena: string): Promise<{ error?: string }> {
  try {
    const { error } = await obtenerSupabase().auth.signInWithPassword({
      email: correo.trim().toLowerCase(),
      password: contrasena,
    });
    if (!error) return {};
    if (isAuthRetryableFetchError(error)) return { error: "Sin conexión a internet. Conéctate y vuelve a intentarlo." };
    switch (error.code) {
      case "invalid_credentials":
        return { error: "Correo o contraseña incorrectos." };
      case "over_request_rate_limit":
        return { error: "Demasiados intentos. Espera unos minutos y vuelve a intentarlo." };
      case "user_banned":
        return { error: "Esta cuenta está deshabilitada. Comunícate con quien te vendió la app." };
      case "email_not_confirmed":
        return { error: "Esta cuenta todavía no está confirmada. Comunícate con quien te vendió la app." };
      default:
        return { error: "No se pudo iniciar sesión. Inténtalo de nuevo." };
    }
  } catch {
    return { error: "No se pudo iniciar sesión. Revisa tu conexión e inténtalo de nuevo." };
  }
}

// Sesión rechazada por el servidor: se descarta todo lo local (no hace falta
// red; signOut "local" borra la sesión antes de avisar al servidor).
export async function olvidarSesion(): Promise<void> {
  epocaSesion++;
  await borrarCertificado();
  await obtenerSupabase()
    .auth.signOut({ scope: "local" })
    .catch(() => {});
}

// - "liberado": este teléfono dejó de ocupar un lugar en la licencia.
// - "no_registrado": no ocupaba ninguno (p. ej. se llegó al límite antes de
//   poder registrarlo) o está bloqueado por el administrador.
// - "sin_conexion": no se pudo avisar al servidor; el lugar sigue ocupado.
export type ResultadoCierreSesion = "liberado" | "no_registrado" | "sin_conexion";

// Cerrar sesión: además libera el lugar que este teléfono ocupaba en la
// licencia (si hay internet), para poder entrar desde otro. Los datos del
// negocio NO se tocan: siguen en el teléfono.
export async function cerrarSesion(codigoDispositivo: string): Promise<ResultadoCierreSesion> {
  let resultado: ResultadoCierreSesion = "sin_conexion";
  try {
    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), TIEMPO_MAXIMO_RED_MS);
    const { data, error } = await obtenerSupabase()
      .rpc("liberar_dispositivo", { p_codigo: codigoDispositivo })
      .abortSignal(controlador.signal);
    clearTimeout(temporizador);
    if (!error) resultado = data === true ? "liberado" : "no_registrado";
  } catch {
    // Sin conexión: la sesión se cierra igual; el lugar lo libera el administrador.
  }
  await olvidarSesion();
  return resultado;
}

// Comprueba que el APK esté firmado con la firma esperada (embebida en el
// plugin nativo). Si alguien lo modificó y lo volvió a firmar con otra
// clave, esto da falso — ver PantallaAppInvalida.
export async function verificarFirmaValida(): Promise<boolean> {
  const { valida } = await LicenciaNativa.verificarFirma();
  return valida;
}
