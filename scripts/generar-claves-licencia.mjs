// Genera el par de claves (ECDSA P-256) con el que se firman los
// certificados de licencia de MIP.
//
//   node scripts/generar-claves-licencia.mjs            (primera vez)
//   node scripts/generar-claves-licencia.mjs --forzar   (rotar la clave)
//
// - La clave PRIVADA queda en supabase/functions/.env (ignorado por git) como
//   MIP_LICENCIA_CLAVE_PRIVADA. De ahí se sube a los secretos de Supabase:
//     npx supabase secrets set --env-file supabase/functions/.env
//   Guarda una copia en un lugar seguro (gestor de contraseñas): Supabase no
//   deja volver a leer un secreto una vez guardado.
// - La clave PÚBLICA se imprime en pantalla y va en
//   mobile/src/lib/backend/config.ts (CLAVES_PUBLICAS_LICENCIA). No es
//   secreta: solo sirve para verificar firmas, no para crearlas.
//
// Rotar la clave: agrega primero la pública nueva a la app (junto a la
// anterior) y distribuye ese APK; recién después sube la privada nueva. Si
// se cambia antes, los teléfonos con la app vieja rechazan los certificados
// nuevos hasta actualizarla.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const RUTA_ENV = path.join(import.meta.dirname, "..", "supabase", "functions", ".env");
const VARIABLE = "MIP_LICENCIA_CLAVE_PRIVADA";

const forzar = process.argv.includes("--forzar");
const contenidoPrevio = existsSync(RUTA_ENV) ? readFileSync(RUTA_ENV, "utf8") : "";
if (new RegExp(`^${VARIABLE}=`, "m").test(contenidoPrevio) && !forzar) {
  console.error(`Ya existe ${VARIABLE} en ${RUTA_ENV}.`);
  console.error("No se sobrescribe para no perder la clave actual. Usa --forzar para rotarla.");
  process.exit(1);
}

const { privateKey, publicKey } = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
  "sign",
  "verify",
]);
const kid = `mip-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}`;

const privada = await crypto.subtle.exportKey("jwk", privateKey);
const publica = await crypto.subtle.exportKey("jwk", publicKey);

const jwkPrivado = { kid, kty: privada.kty, crv: privada.crv, x: privada.x, y: privada.y, d: privada.d };
const jwkPublico = { kty: publica.kty, crv: publica.crv, x: publica.x, y: publica.y };

const linea = `${VARIABLE}=${Buffer.from(JSON.stringify(jwkPrivado)).toString("base64")}`;
const sinLineaVieja = contenidoPrevio
  .split(/\r?\n/)
  .filter((l) => l && !l.startsWith(`${VARIABLE}=`))
  .join("\n");
writeFileSync(RUTA_ENV, `${sinLineaVieja ? `${sinLineaVieja}\n` : ""}${linea}\n`, "utf8");

console.log(`Clave privada guardada en ${RUTA_ENV} (kid: ${kid}).`);
console.log("\nAgrega esta clave pública a CLAVES_PUBLICAS_LICENCIA en mobile/src/lib/backend/config.ts:\n");
console.log(`  "${kid}": ${JSON.stringify(jwkPublico)},`);
