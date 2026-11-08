// Administración de clientes y licencias de MIP (usa tu sesión de la CLI de
// Supabase; ver scripts/lib/proyecto.mjs).
//
//   npm run clientes -- ayuda
import { randomInt } from "node:crypto";
import { buscarUsuarioPorCorreo, clienteAdmin, listarTodosLosUsuarios } from "./lib/proyecto.mjs";

const AYUDA = `
Uso: npm run clientes -- <comando> [argumentos]

  crear <correo> [--dispositivos N] [--vence AAAA-MM-DD] [--notas "texto"] [--contrasena X]
        Crea la cuenta del cliente con su licencia activa. Si no indicas
        contraseña, se genera una y se muestra (pásasela al cliente).
  listar                               Todos los clientes y el estado de su licencia.
  ver <correo>                         Detalle de la licencia y sus teléfonos.
  suspender <correo>                   La app deja de funcionar en cuanto se conecte.
  reactivar <correo>
  vencimiento <correo> <AAAA-MM-DD|nunca>
  max-dispositivos <correo> <N>
  liberar <correo> <codigo>            Quita un teléfono de la licencia (cambio de teléfono).
  bloquear <correo> <codigo>           Bloquea un teléfono (robado/perdido).
  desbloquear <correo> <codigo>
  contrasena <correo> [nueva]          Asigna una contraseña nueva (si no indicas, se genera).
  borrar <correo>                      Borra la cuenta y su licencia. No se puede deshacer.

Las fechas de vencimiento se toman hasta el final de ese día, en la hora de esta PC.
`;

const ALFABETO = "abcdefghjkmnpqrstuvwxyz23456789";

function generarContrasena() {
  const grupo = () => Array.from({ length: 4 }, () => ALFABETO[randomInt(ALFABETO.length)]).join("");
  return `${grupo()}-${grupo()}-${grupo()}`;
}

function fallar(mensaje) {
  console.error(`Error: ${mensaje}`);
  process.exit(1);
}

function leerOpciones(args) {
  const posicionales = [];
  const opciones = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const nombre = args[i].slice(2);
      const valor = args[i + 1];
      if (valor === undefined || valor.startsWith("--")) fallar(`Falta el valor de --${nombre}`);
      opciones[nombre] = valor;
      i++;
    } else {
      posicionales.push(args[i]);
    }
  }
  return { posicionales, opciones };
}

function finDelDia(texto) {
  if (texto === "nunca") return null;
  const coincidencia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto ?? "");
  if (!coincidencia) fallar(`Fecha inválida "${texto}": usa AAAA-MM-DD o "nunca"`);
  const [, anio, mes, dia] = coincidencia.map(Number);
  const fecha = new Date(anio, mes - 1, dia, 23, 59, 59);
  if (fecha.getMonth() !== mes - 1) fallar(`La fecha "${texto}" no existe`);
  return fecha.toISOString();
}

function entero(texto, nombre, minimo, maximo) {
  const n = Number(texto);
  if (!Number.isInteger(n) || n < minimo || n > maximo) fallar(`${nombre} debe ser un número entre ${minimo} y ${maximo}`);
  return n;
}

function normalizarCodigo(codigo) {
  const limpio = String(codigo ?? "").trim().toUpperCase();
  if (!/^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/.test(limpio)) {
    fallar(`Código de dispositivo inválido "${codigo}" (formato: ABCD-1234-EF56)`);
  }
  return limpio;
}

function fecha(iso) {
  return iso ? new Date(iso).toLocaleString("es") : "—";
}

// Se crea recién después de leer el comando: `ayuda` no necesita claves.
let admin;

async function usuarioYLicencia(correo) {
  if (!correo) fallar("Falta el correo del cliente");
  const usuario = await buscarUsuarioPorCorreo(admin, correo);
  if (!usuario) fallar(`No existe ningún cliente con el correo ${correo}`);
  const { data: licencia, error } = await admin
    .from("licencias")
    .select("*, dispositivos(*)")
    .eq("usuario_id", usuario.id)
    .maybeSingle();
  if (error) throw error;
  return { usuario, licencia };
}

async function actualizarLicencia(correo, cambios, mensaje) {
  const { licencia } = await usuarioYLicencia(correo);
  if (!licencia) fallar(`${correo} no tiene licencia`);
  const { error } = await admin.from("licencias").update(cambios).eq("id", licencia.id);
  if (error) throw error;
  console.log(mensaje);
}

async function actualizarDispositivo(correo, codigo, accion) {
  const { licencia } = await usuarioYLicencia(correo);
  if (!licencia) fallar(`${correo} no tiene licencia`);
  const consulta =
    accion === "liberar"
      ? admin.from("dispositivos").delete()
      : admin.from("dispositivos").update({ bloqueado: accion === "bloquear" });
  const { data, error } = await consulta.eq("licencia_id", licencia.id).eq("codigo", codigo).select("id");
  if (error) throw error;
  if (!data.length) fallar(`El teléfono ${codigo} no está registrado en la licencia de ${correo}`);
}

const comandos = {
  async crear({ posicionales: [correo], opciones }) {
    if (!correo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) fallar("Indica un correo válido");
    const contrasena = opciones.contrasena ?? generarContrasena();
    if (contrasena.length < 8) fallar("La contraseña debe tener al menos 8 caracteres");
    const maxDispositivos = opciones.dispositivos ? entero(opciones.dispositivos, "--dispositivos", 1, 50) : 1;
    const venceEl = opciones.vence ? finDelDia(opciones.vence) : null;

    const { data, error } = await admin.auth.admin.createUser({
      email: correo.trim().toLowerCase(),
      password: contrasena,
      email_confirm: true,
    });
    if (error) fallar(`No se pudo crear la cuenta: ${error.message}`);

    const { error: errorLicencia } = await admin.from("licencias").insert({
      usuario_id: data.user.id,
      max_dispositivos: maxDispositivos,
      vence_el: venceEl,
      notas: opciones.notas ?? null,
    });
    if (errorLicencia) {
      // Sin licencia la cuenta no sirve: se deshace para poder reintentar.
      await admin.auth.admin.deleteUser(data.user.id);
      throw errorLicencia;
    }

    console.log("Cliente creado.");
    console.log(`  Correo:       ${data.user.email}`);
    console.log(`  Contraseña:   ${contrasena}`);
    console.log(`  Dispositivos: ${maxDispositivos}`);
    console.log(`  Vence:        ${venceEl ? fecha(venceEl) : "sin vencimiento"}`);
  },

  async listar() {
    const [usuarios, { data: licencias, error }] = await Promise.all([
      listarTodosLosUsuarios(admin),
      admin.from("licencias").select("*, dispositivos(*)"),
    ]);
    if (error) throw error;
    const porUsuario = new Map(licencias.map((l) => [l.usuario_id, l]));
    const filas = usuarios
      .sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""))
      .map((u) => {
        const l = porUsuario.get(u.id);
        const enUso = l?.dispositivos.filter((d) => !d.bloqueado).length ?? 0;
        const ultimo = l?.dispositivos.map((d) => d.ultimo_contacto_el).sort().at(-1);
        return {
          correo: u.email,
          licencia: l ? l.estado : "SIN LICENCIA",
          vence: l?.vence_el ? fecha(l.vence_el) : l ? "nunca" : "—",
          telefonos: l ? `${enUso}/${l.max_dispositivos}` : "—",
          "último contacto": fecha(ultimo),
        };
      });
    if (!filas.length) console.log("Todavía no hay clientes.");
    else console.table(filas);
  },

  async ver({ posicionales: [correo] }) {
    const { usuario, licencia } = await usuarioYLicencia(correo);
    console.log(`Cliente: ${usuario.email} (creado ${fecha(usuario.created_at)}, último ingreso ${fecha(usuario.last_sign_in_at)})`);
    if (!licencia) {
      console.log("Sin licencia.");
      return;
    }
    console.log(`Licencia: ${licencia.estado}, vence ${licencia.vence_el ? fecha(licencia.vence_el) : "nunca"}, hasta ${licencia.max_dispositivos} teléfono(s)`);
    if (licencia.notas) console.log(`Notas: ${licencia.notas}`);
    if (!licencia.dispositivos.length) {
      console.log("Sin teléfonos registrados.");
      return;
    }
    console.table(
      licencia.dispositivos.map((d) => ({
        codigo: d.codigo,
        nombre: d.nombre ?? "—",
        estado: d.bloqueado ? "BLOQUEADO" : "en uso",
        activado: fecha(d.activado_el),
        "último contacto": fecha(d.ultimo_contacto_el),
      })),
    );
  },

  async suspender({ posicionales: [correo] }) {
    await actualizarLicencia(correo, { estado: "suspendida" }, `Licencia de ${correo} suspendida.`);
  },

  async reactivar({ posicionales: [correo] }) {
    await actualizarLicencia(correo, { estado: "activa" }, `Licencia de ${correo} reactivada.`);
  },

  async vencimiento({ posicionales: [correo, cuando] }) {
    const venceEl = finDelDia(cuando);
    await actualizarLicencia(
      correo,
      { vence_el: venceEl },
      `Licencia de ${correo}: ${venceEl ? `vence ${fecha(venceEl)}` : "sin vencimiento"}.`,
    );
  },

  async "max-dispositivos"({ posicionales: [correo, cantidad] }) {
    const max = entero(cantidad, "La cantidad", 1, 50);
    await actualizarLicencia(correo, { max_dispositivos: max }, `Licencia de ${correo}: hasta ${max} teléfono(s).`);
  },

  async liberar({ posicionales: [correo, codigo] }) {
    const limpio = normalizarCodigo(codigo);
    await actualizarDispositivo(correo, limpio, "liberar");
    console.log(`Teléfono ${limpio} quitado de la licencia de ${correo}.`);
  },

  async bloquear({ posicionales: [correo, codigo] }) {
    const limpio = normalizarCodigo(codigo);
    await actualizarDispositivo(correo, limpio, "bloquear");
    console.log(`Teléfono ${limpio} bloqueado: no podrá renovar la licencia la próxima vez que se conecte.`);
  },

  async desbloquear({ posicionales: [correo, codigo] }) {
    const limpio = normalizarCodigo(codigo);
    await actualizarDispositivo(correo, limpio, "desbloquear");
    console.log(`Teléfono ${limpio} desbloqueado.`);
  },

  async contrasena({ posicionales: [correo, nueva] }) {
    const { usuario } = await usuarioYLicencia(correo);
    const contrasena = nueva ?? generarContrasena();
    if (contrasena.length < 8) fallar("La contraseña debe tener al menos 8 caracteres");
    const { error } = await admin.auth.admin.updateUserById(usuario.id, { password: contrasena });
    if (error) fallar(`No se pudo cambiar la contraseña: ${error.message}`);
    console.log(`Contraseña nueva de ${usuario.email}: ${contrasena}`);
  },

  async borrar({ posicionales: [correo] }) {
    const { usuario } = await usuarioYLicencia(correo);
    const { error } = await admin.auth.admin.deleteUser(usuario.id);
    if (error) fallar(`No se pudo borrar: ${error.message}`);
    console.log(`Cliente ${usuario.email} borrado (con su licencia y teléfonos).`);
  },
};

const [comando, ...resto] = process.argv.slice(2);
if (!comando || comando === "ayuda" || comando === "--help" || !comandos[comando]) {
  if (comando && comando !== "ayuda" && comando !== "--help") console.error(`Comando desconocido: ${comando}`);
  console.log(AYUDA);
  process.exit(comando && comando !== "ayuda" && comando !== "--help" ? 1 : 0);
}

try {
  const argumentos = leerOpciones(resto);
  admin = clienteAdmin();
  await comandos[comando](argumentos);
} catch (error) {
  fallar(error.message ?? String(error));
}
