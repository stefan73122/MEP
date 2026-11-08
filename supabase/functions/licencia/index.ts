// Edge Function "licencia": la app móvil la llama con la sesión del cliente
// (después de iniciar sesión y, en segundo plano, cada vez que hay internet).
//
// 1. withSupabase verifica el JWT del usuario (JWKS del proyecto) y arma un
//    cliente con RLS a su nombre.
// 2. activar_dispositivo() (ver supabase/migrations) decide si la licencia
//    está vigente y registra el teléfono, respetando el límite.
// 3. Si todo está bien, se devuelve un CERTIFICADO firmado (JWT ES256) que la
//    app guarda y verifica sin conexión con la clave pública que lleva
//    embebida. Así la app sigue funcionando sin internet hasta que vence el
//    certificado, y nadie puede fabricar uno: la clave privada vive solo en
//    los secretos de Supabase (MIP_LICENCIA_CLAVE_PRIVADA).
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { firmarCertificado, importarClavePrivada, type ClaveFirma } from "./certificado.ts";

const DIA_EN_SEGUNDOS = 24 * 60 * 60;

// Cuántos días puede usarse la app sin conectarse a renovar el certificado.
// Se cambia sin publicar otra versión de la app ni redesplegar (se lee en
// cada pedido):
//   npx supabase secrets set MIP_LICENCIA_DIAS_SIN_CONEXION=15
function diasSinConexion(): number {
  const valor = Number(Deno.env.get("MIP_LICENCIA_DIAS_SIN_CONEXION"));
  return Number.isInteger(valor) && valor >= 1 && valor <= 90 ? valor : 30;
}

// Motivos con los que activar_dispositivo() puede negar la licencia; la app
// muestra un mensaje distinto para cada uno.
const MOTIVOS_DENEGACION = new Set([
  "sin_licencia",
  "licencia_suspendida",
  "licencia_vencida",
  "limite_dispositivos",
  "dispositivo_bloqueado",
  "dispositivo_invalido",
]);

// Se importa una sola vez por instancia de la función; si falla (secreto
// mal cargado) se vuelve a intentar en el próximo pedido.
let claveFirma: Promise<ClaveFirma> | null = null;

function cargarClaveFirma(): Promise<ClaveFirma> {
  claveFirma ??= (async () => {
    const codificada = Deno.env.get("MIP_LICENCIA_CLAVE_PRIVADA");
    if (!codificada) throw new Error("Falta el secreto MIP_LICENCIA_CLAVE_PRIVADA");
    return await importarClavePrivada(codificada);
  })().catch((error) => {
    claveFirma = null;
    throw error;
  });
  return claveFirma;
}

function responder(estado: number, cuerpo: Record<string, unknown>): Response {
  return Response.json(cuerpo, { status: estado });
}

export default {
  fetch: withSupabase(
    // audience "authenticated": solo JWT de usuarios con sesión iniciada (no
    // el de la clave anónima). errors.detailed=false: ante un JWT inválido
    // se responde 401 sin pistas de configuración.
    { auth: "user", audience: "authenticated", errors: { detailed: false } },
    async (req, ctx) => {
      if (req.method !== "POST") return responder(405, { codigo: "metodo_no_permitido" });

      const usuario = ctx.userClaims;
      if (!usuario?.id) return responder(401, { codigo: "no_autenticado" });

      const entrada = await req.json().catch(() => null);
      const codigoDispositivo =
        typeof entrada?.codigoDispositivo === "string" ? entrada.codigoDispositivo.trim().toUpperCase() : "";
      const nombreDispositivo =
        typeof entrada?.nombreDispositivo === "string" ? entrada.nombreDispositivo.trim().slice(0, 100) || null : null;

      const { data: resultado, error } = await ctx.supabase.rpc("activar_dispositivo", {
        p_codigo: codigoDispositivo,
        p_nombre: nombreDispositivo,
      });

      if (error || !resultado) {
        console.error("activar_dispositivo falló:", error?.code, error?.message);
        return responder(500, { codigo: "error_interno" });
      }

      if (!resultado.ok) {
        const codigo = MOTIVOS_DENEGACION.has(resultado.codigo) ? resultado.codigo : "error_interno";
        return responder(codigo === "dispositivo_invalido" ? 400 : 403, {
          codigo,
          venceEl: resultado.vence_el ?? null,
          maxDispositivos: resultado.max_dispositivos ?? null,
        });
      }

      const ahora = Math.floor(Date.now() / 1000);
      const venceLicencia = resultado.vence_el ? Math.floor(Date.parse(resultado.vence_el) / 1000) : null;
      // El certificado nunca dura más que la propia licencia.
      const exp = Math.min(ahora + diasSinConexion() * DIA_EN_SEGUNDOS, venceLicencia ?? Number.POSITIVE_INFINITY);

      let certificado: string;
      try {
        certificado = await firmarCertificado(await cargarClaveFirma(), {
          iss: "mip-licencias",
          sub: usuario.id,
          email: usuario.email ?? null,
          lic: resultado.licencia_id,
          disp: codigoDispositivo,
          iat: ahora,
          exp,
          vlic: venceLicencia,
        });
      } catch (errorFirma) {
        console.error("No se pudo firmar el certificado:", (errorFirma as Error).message);
        return responder(500, { codigo: "error_interno" });
      }

      return responder(200, {
        certificado,
        licencia: {
          venceEl: resultado.vence_el,
          maxDispositivos: resultado.max_dispositivos,
          dispositivosEnUso: resultado.dispositivos_en_uso,
        },
      });
    },
  ),
};
