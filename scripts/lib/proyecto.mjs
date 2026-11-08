// Datos del proyecto de Supabase para los scripts de administración.
//
// Las claves se piden en el momento a la CLI de Supabase con tu sesión
// (`npx supabase login`), así la clave SECRETA no se guarda en ningún
// archivo. En otra máquina o en CI se pueden pasar por variables de entorno:
// SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY y SUPABASE_SECRET_KEY.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

export const RAIZ = path.join(import.meta.dirname, "..", "..");

export function refProyecto() {
  const ruta = path.join(RAIZ, "supabase", ".temp", "project-ref");
  if (existsSync(ruta)) return readFileSync(ruta, "utf8").trim();
  return process.env.SUPABASE_PROJECT_REF || "mofhbzymjfpakhbejmuc";
}

// La CLI (devDependency "supabase") es un script de Node: se ejecuta con el
// mismo node, sin pasar por una shell.
const CLI_SUPABASE = path.join(
  path.dirname(createRequire(import.meta.url).resolve("supabase/package.json")),
  "dist",
  "supabase.js",
);

function clavesDesdeCli() {
  let salida;
  try {
    salida = execFileSync(process.execPath, [CLI_SUPABASE, "projects", "api-keys", "--reveal", "--output-format", "json"], {
      cwd: RAIZ,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    const detalle = String(error.stderr || error.stdout || error.message).trim();
    throw new Error(
      `No se pudieron obtener las claves con la CLI de Supabase.\n` +
        `¿Iniciaste sesión (npx supabase login) y enlazaste el proyecto (npx supabase link)?\n${detalle}`,
    );
  }

  // La CLI a veces imprime un aviso antes del JSON.
  const inicio = [salida.indexOf("{"), salida.indexOf("[")].filter((i) => i >= 0).sort((a, b) => a - b)[0];
  const datos = JSON.parse(salida.slice(inicio ?? 0));
  const lista = Array.isArray(datos) ? datos : (datos.api_keys ?? datos.keys ?? datos.data ?? []);
  const valorDe = (k) => k.api_key ?? k.apiKey ?? k.key ?? k.value;
  const buscar = (tipo, nombreLegado) =>
    lista.find((k) => k.type === tipo && valorDe(k)) ?? lista.find((k) => k.name === nombreLegado && valorDe(k));

  const publicable = buscar("publishable", "anon");
  const secreta = buscar("secret", "service_role");
  if (!publicable || !secreta) {
    throw new Error("La CLI no devolvió una clave publicable y una secreta para el proyecto.");
  }
  return { publicable: valorDe(publicable), secreta: valorDe(secreta) };
}

let cache = null;

export function datosProyecto() {
  if (cache) return cache;
  const url = process.env.SUPABASE_URL || `https://${refProyecto()}.supabase.co`;
  const desdeEntorno =
    process.env.SUPABASE_PUBLISHABLE_KEY && process.env.SUPABASE_SECRET_KEY
      ? { publicable: process.env.SUPABASE_PUBLISHABLE_KEY, secreta: process.env.SUPABASE_SECRET_KEY }
      : null;
  cache = { url, ...(desdeEntorno ?? clavesDesdeCli()) };
  return cache;
}

const OPCIONES_SIN_SESION = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

// Cliente con la clave secreta: ignora RLS. Solo para administrar.
export function clienteAdmin() {
  const { url, secreta } = datosProyecto();
  return createClient(url, secreta, OPCIONES_SIN_SESION);
}

// Cliente con la clave publicable: lo mismo que puede hacer la app.
export function clientePublico() {
  const { url, publicable } = datosProyecto();
  return createClient(url, publicable, OPCIONES_SIN_SESION);
}

export async function buscarUsuarioPorCorreo(admin, correo) {
  const buscado = correo.trim().toLowerCase();
  for (let pagina = 1; ; pagina++) {
    const { data, error } = await admin.auth.admin.listUsers({ page: pagina, perPage: 1000 });
    if (error) throw error;
    const usuario = data.users.find((u) => u.email?.toLowerCase() === buscado);
    if (usuario) return usuario;
    if (data.users.length < 1000) return null;
  }
}

export async function listarTodosLosUsuarios(admin) {
  const todos = [];
  for (let pagina = 1; ; pagina++) {
    const { data, error } = await admin.auth.admin.listUsers({ page: pagina, perPage: 1000 });
    if (error) throw error;
    todos.push(...data.users);
    if (data.users.length < 1000) return todos;
  }
}
