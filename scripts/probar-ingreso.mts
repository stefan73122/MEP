// Prueba de punta a punta del ingreso de clientes, contra el proyecto real:
//
//   npm run probar:ingreso
//
// Crea dos cuentas temporales (una con licencia y otra sin), recorre todo lo
// que hace la app (iniciar sesión, pedir el certificado, renovarlo, cerrar
// sesión...) y los ataques más obvios (adulterar el certificado, tocar la
// licencia con la clave publicable, atrasar el reloj...). Al final borra las
// cuentas temporales, salga bien o mal.
//
// Usa el MISMO código que la app para verificar certificados
// (mobile/src/lib/certificadoLicencia.ts) y la misma configuración pública
// (mobile/src/lib/backend/config.ts).
import { randomBytes, randomUUID } from "node:crypto";
import { clienteAdmin, clientePublico, datosProyecto } from "./lib/proyecto.mjs";
import {
  CLAVES_PUBLICAS_LICENCIA,
  SUPABASE_CLAVE_PUBLICABLE,
  SUPABASE_URL,
} from "../mobile/src/lib/backend/config.ts";
import { evaluarCertificado, verificarCertificado } from "../mobile/src/lib/certificadoLicencia.ts";

const DIA = 24 * 60 * 60;
let fallas = 0;

function comprobar(nombre: string, ok: boolean, detalle?: unknown) {
  if (!ok) fallas++;
  console.log(`${ok ? "✔" : "✘"} ${nombre}`);
  if (!ok && detalle !== undefined) console.log(`    → ${typeof detalle === "string" ? detalle : JSON.stringify(detalle)}`);
}

function codigoAleatorio(): string {
  return (randomBytes(6).toString("hex").toUpperCase().match(/.{4}/g) ?? []).join("-");
}

// Igual que llamarFuncionLicencia() en mobile/src/lib/licencia.ts.
async function llamarLicencia(token: string | null, codigoDispositivo: string) {
  const headers: Record<string, string> = { apikey: SUPABASE_CLAVE_PUBLICABLE, "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const respuesta = await fetch(`${SUPABASE_URL}/functions/v1/licencia`, {
    method: "POST",
    headers,
    body: JSON.stringify({ codigoDispositivo, nombreDispositivo: "Prueba automática" }),
  });
  return { status: respuesta.status, cuerpo: (await respuesta.json().catch(() => null)) as Record<string, any> | null };
}

const { url, publicable } = datosProyecto();
console.log(`Proyecto: ${url}\n`);
comprobar("La app apunta a este proyecto", SUPABASE_URL === url, `${SUPABASE_URL} ≠ ${url}`);
comprobar(
  "La clave publicable de la app es la del proyecto",
  SUPABASE_CLAVE_PUBLICABLE === publicable,
  "Actualiza SUPABASE_CLAVE_PUBLICABLE en mobile/src/lib/backend/config.ts",
);

const admin = clienteAdmin();
const sufijo = randomUUID().slice(0, 8);
const correoConLicencia = `mip-prueba-${sufijo}@example.com`;
const correoSinLicencia = `mip-prueba-sinlicencia-${sufijo}@example.com`;
const contrasena = `Prueba-${randomUUID()}`;
const creados: string[] = [];

async function crearUsuario(email: string): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({ email, password: contrasena, email_confirm: true });
  if (error) throw error;
  creados.push(data.user.id);
  return data.user.id;
}

try {
  // --- Preparación (como el administrador) ----------------------------------
  const idConLicencia = await crearUsuario(correoConLicencia);
  const idSinLicencia = await crearUsuario(correoSinLicencia);
  const { data: licencia, error: errorLicencia } = await admin
    .from("licencias")
    .insert({ usuario_id: idConLicencia, max_dispositivos: 1, notas: "Prueba automática (se borra sola)" })
    .select()
    .single();
  if (errorLicencia) throw errorLicencia;

  const telefonoA = codigoAleatorio();
  const telefonoB = codigoAleatorio();

  // --- Registro e inicio de sesión ------------------------------------------
  console.log("\nInicio de sesión");
  const intruso = await clientePublico().auth.signUp({ email: `mip-intruso-${sufijo}@example.com`, password: contrasena });
  if (intruso.data.user) creados.push(intruso.data.user.id);
  comprobar("Nadie puede crearse una cuenta solo (registro público desactivado)", !!intruso.error && !intruso.data.user, intruso.error?.code ?? "signUp creó un usuario");

  const incorrecta = await clientePublico().auth.signInWithPassword({ email: correoConLicencia, password: "incorrecta-123" });
  comprobar("Contraseña incorrecta: rechazada", incorrecta.error?.code === "invalid_credentials", incorrecta.error?.code);

  const cliente = clientePublico();
  const ingreso = await cliente.auth.signInWithPassword({ email: correoConLicencia, password: contrasena });
  comprobar("El cliente inicia sesión con su correo y contraseña", !!ingreso.data.session, ingreso.error?.message);
  if (!ingreso.data.session) throw new Error("Sin sesión no se puede seguir probando");
  const token = ingreso.data.session.access_token;

  // --- Certificado ------------------------------------------------------------
  console.log("\nCertificado de licencia");
  const r1 = await llamarLicencia(token, telefonoA);
  comprobar("Recibe un certificado para su teléfono", r1.status === 200 && typeof r1.cuerpo?.certificado === "string", r1);
  const certificado = String(r1.cuerpo?.certificado ?? "");
  const datos = await verificarCertificado(certificado, CLAVES_PUBLICAS_LICENCIA);
  comprobar("La app verifica la firma del certificado", !!datos);
  if (!datos) throw new Error("Sin certificado válido no se puede seguir probando");
  const ahora = Date.now();
  comprobar("Vale en ese teléfono", evaluarCertificado(datos, telefonoA, ahora, 0) === "valido");
  comprobar("No sirve copiado a otro teléfono", evaluarCertificado(datos, telefonoB, ahora, 0) === "otro_dispositivo");
  comprobar("Funciona 30 días sin conexión", datos.exp - datos.iat === 30 * DIA, datos.exp - datos.iat);
  comprobar("Vencido el plazo, deja de valer", evaluarCertificado(datos, telefonoA, (datos.exp + 1) * 1000, 0) === "vencido");
  comprobar(
    "Lleva los datos del cliente y su licencia",
    datos.sub === idConLicencia && datos.email === correoConLicencia && datos.lic === licencia.id && datos.disp === telefonoA,
    datos,
  );
  comprobar(
    "Atrasar el reloj del teléfono se detecta",
    evaluarCertificado(datos, telefonoA, ahora - 3 * DIA * 1000, ahora) === "reloj_atrasado",
  );

  const [encabezado, , firma] = certificado.split(".");
  const cuerpoFalso = Buffer.from(JSON.stringify({ ...datos, exp: datos.exp + 365 * DIA })).toString("base64url");
  comprobar(
    "Un certificado adulterado (más días) se rechaza",
    (await verificarCertificado(`${encabezado}.${cuerpoFalso}.${firma}`, CLAVES_PUBLICAS_LICENCIA)) === null,
  );

  const r2 = await llamarLicencia(token, telefonoA);
  comprobar("Renueva desde el mismo teléfono", r2.status === 200, r2);

  const r3 = await llamarLicencia(token, telefonoB);
  comprobar("Un segundo teléfono supera el límite (1)", r3.status === 403 && r3.cuerpo?.codigo === "limite_dispositivos", r3);

  const r4 = await llamarLicencia(token, "esto-no-es-un-codigo");
  comprobar("Código de dispositivo inválido: rechazado", r4.status === 400 && r4.cuerpo?.codigo === "dispositivo_invalido", r4);

  // --- Lo que NO puede hacer el cliente con la clave publicable --------------
  console.log("\nProtección de datos (RLS)");
  const propias = await cliente.from("licencias").select("*");
  comprobar("Solo ve su propia licencia", !propias.error && propias.data?.length === 1 && propias.data[0].id === licencia.id, propias.error ?? propias.data);
  const edicion = await cliente
    .from("licencias")
    .update({ estado: "activa", max_dispositivos: 50, vence_el: null })
    .eq("id", licencia.id)
    .select();
  comprobar("No puede modificar su licencia", !!edicion.error || edicion.data?.length === 0, edicion.data);
  const altaLicencia = await cliente.from("licencias").insert({ usuario_id: idSinLicencia });
  comprobar("No puede crear licencias", !!altaLicencia.error);
  const altaTelefono = await cliente.from("dispositivos").insert({ licencia_id: licencia.id, codigo: telefonoB });
  comprobar("No puede registrar teléfonos a mano", !!altaTelefono.error);
  const { data: licenciaReal } = await admin.from("licencias").select("max_dispositivos, estado").eq("id", licencia.id).single();
  comprobar("La licencia sigue intacta", licenciaReal?.max_dispositivos === 1 && licenciaReal?.estado === "activa", licenciaReal);
  const anonimo = await clientePublico().from("licencias").select("*");
  comprobar("Sin sesión no se ve ninguna licencia", !!anonimo.error || anonimo.data?.length === 0, anonimo.data?.length);

  // --- Cerrar sesión libera el teléfono --------------------------------------
  console.log("\nCambio de teléfono");
  const liberado = await cliente.rpc("liberar_dispositivo", { p_codigo: telefonoA });
  comprobar("Al cerrar sesión se libera el teléfono", liberado.data === true, liberado.error ?? liberado.data);
  const r5 = await llamarLicencia(token, telefonoB);
  comprobar("Después puede entrar desde otro teléfono", r5.status === 200, r5);

  // --- Acciones del administrador ---------------------------------------------
  console.log("\nAdministración");
  await admin.from("licencias").update({ estado: "suspendida" }).eq("id", licencia.id);
  const r6 = await llamarLicencia(token, telefonoB);
  comprobar("Licencia suspendida: rechazada", r6.status === 403 && r6.cuerpo?.codigo === "licencia_suspendida", r6);
  await admin.from("licencias").update({ estado: "activa" }).eq("id", licencia.id);

  await admin.from("licencias").update({ vence_el: new Date(Date.now() - DIA * 1000).toISOString() }).eq("id", licencia.id);
  const r7 = await llamarLicencia(token, telefonoB);
  comprobar("Licencia vencida: rechazada", r7.status === 403 && r7.cuerpo?.codigo === "licencia_vencida", r7);

  const venceEn5Dias = Math.floor(Date.now() / 1000) + 5 * DIA;
  await admin.from("licencias").update({ vence_el: new Date(venceEn5Dias * 1000).toISOString() }).eq("id", licencia.id);
  const r8 = await llamarLicencia(token, telefonoB);
  const datos8 = r8.cuerpo?.certificado ? await verificarCertificado(r8.cuerpo.certificado, CLAVES_PUBLICAS_LICENCIA) : null;
  comprobar(
    "Si la licencia vence antes, el certificado no dura más que ella",
    r8.status === 200 && !!datos8 && datos8.exp <= venceEn5Dias && datos8.vlic === venceEn5Dias,
    datos8 ?? r8,
  );
  await admin.from("licencias").update({ vence_el: null }).eq("id", licencia.id);

  await admin.from("dispositivos").update({ bloqueado: true }).eq("licencia_id", licencia.id).eq("codigo", telefonoB);
  const r9 = await llamarLicencia(token, telefonoB);
  comprobar("Teléfono bloqueado: rechazado", r9.status === 403 && r9.cuerpo?.codigo === "dispositivo_bloqueado", r9);
  const liberarBloqueado = await cliente.rpc("liberar_dispositivo", { p_codigo: telefonoB });
  comprobar("Un teléfono bloqueado no se puede liberar desde la app", liberarBloqueado.data === false, liberarBloqueado);

  const clienteSinLicencia = clientePublico();
  const ingresoSinLicencia = await clienteSinLicencia.auth.signInWithPassword({ email: correoSinLicencia, password: contrasena });
  const r10 = await llamarLicencia(ingresoSinLicencia.data.session?.access_token ?? null, codigoAleatorio());
  comprobar("Cuenta sin licencia: rechazada", r10.status === 403 && r10.cuerpo?.codigo === "sin_licencia", r10);

  // --- Llamadas sin credenciales válidas --------------------------------------
  console.log("\nCredenciales");
  const r11 = await llamarLicencia(null, telefonoA);
  comprobar("Sin sesión: 401", r11.status === 401, r11);
  const tokenAdulterado = `${token.slice(0, -4)}${token.endsWith("AAAA") ? "BBBB" : "AAAA"}`;
  const r12 = await llamarLicencia(tokenAdulterado, telefonoA);
  comprobar("Token adulterado: 401", r12.status === 401, r12);
  const r13 = await llamarLicencia(publicable, telefonoA);
  comprobar("La clave publicable sola no alcanza: 401", r13.status === 401, r13);

  const preflight = await fetch(`${SUPABASE_URL}/functions/v1/licencia`, {
    method: "OPTIONS",
    headers: {
      Origin: "https://localhost",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "authorization, apikey, content-type",
    },
  });
  comprobar(
    "CORS: la app (https://localhost dentro del APK) puede llamar a la función",
    preflight.ok &&
      !!preflight.headers.get("access-control-allow-origin") &&
      /authorization/i.test(preflight.headers.get("access-control-allow-headers") ?? ""),
    { status: preflight.status, origen: preflight.headers.get("access-control-allow-origin") },
  );

  await cliente.auth.signOut({ scope: "local" });
  await clienteSinLicencia.auth.signOut({ scope: "local" });
} catch (error) {
  fallas++;
  console.error("\nLa prueba se cortó:", error instanceof Error ? error.message : error);
} finally {
  for (const id of creados) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) console.error(`No se pudo borrar la cuenta temporal ${id}: ${error.message}`);
  }
  console.log(`\nCuentas temporales borradas: ${creados.length}.`);
}

console.log(fallas ? `\n${fallas} comprobación(es) fallaron.` : "\nTodo bien: los clientes pueden ingresar y la licencia está protegida.");
process.exit(fallas ? 1 : 0);
