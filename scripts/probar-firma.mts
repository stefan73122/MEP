// Prueba local (sin internet) de que la clave privada de supabase/functions/.env
// y la clave pública que lleva la app forman pareja, y de que lo que firma la
// Edge Function lo acepta la app (y lo adulterado no):
//
//   npm run probar:firma
//
// Usa el código real de los dos lados: supabase/functions/licencia/certificado.ts
// (servidor) y mobile/src/lib/certificadoLicencia.ts (app).
import { readFileSync } from "node:fs";
import path from "node:path";
import { firmarCertificado, importarClavePrivada } from "../supabase/functions/licencia/certificado.ts";
import { CLAVES_PUBLICAS_LICENCIA } from "../mobile/src/lib/backend/config.ts";
import { evaluarCertificado, verificarCertificado } from "../mobile/src/lib/certificadoLicencia.ts";

const rutaEnv = path.join(import.meta.dirname, "..", "supabase", "functions", ".env");
const linea = readFileSync(rutaEnv, "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("MIP_LICENCIA_CLAVE_PRIVADA="));
if (!linea) throw new Error(`No está MIP_LICENCIA_CLAVE_PRIVADA en ${rutaEnv}`);

const clave = await importarClavePrivada(linea.slice(linea.indexOf("=") + 1).trim());
let fallas = 0;
function comprobar(nombre: string, ok: boolean) {
  if (!ok) fallas++;
  console.log(`${ok ? "✔" : "✘"} ${nombre}`);
}

comprobar(`La app conoce la clave pública "${clave.kid}"`, clave.kid in CLAVES_PUBLICAS_LICENCIA);

const ahora = Math.floor(Date.now() / 1000);
const datos = {
  iss: "mip-licencias",
  sub: "00000000-0000-0000-0000-000000000001",
  email: "cliénte@ejemplo.com",
  lic: "00000000-0000-0000-0000-000000000002",
  disp: "ABCD-1234-EF56",
  iat: ahora,
  exp: ahora + 30 * 24 * 60 * 60,
  vlic: null,
};
const certificado = await firmarCertificado(clave, datos);
const verificado = await verificarCertificado(certificado, CLAVES_PUBLICAS_LICENCIA);
comprobar("La app acepta un certificado firmado por la función", JSON.stringify(verificado) === JSON.stringify(datos));
comprobar("Es válido en su teléfono", !!verificado && evaluarCertificado(verificado, datos.disp, Date.now(), 0) === "valido");

const [encabezado, , firma] = certificado.split(".");
const adulterado = Buffer.from(JSON.stringify({ ...datos, exp: datos.exp + 999999 })).toString("base64url");
comprobar("Rechaza el cuerpo adulterado", (await verificarCertificado(`${encabezado}.${adulterado}.${firma}`, CLAVES_PUBLICAS_LICENCIA)) === null);

const otroKid = Buffer.from(JSON.stringify({ alg: "ES256", typ: "JWT", kid: "desconocida" })).toString("base64url");
comprobar("Rechaza una clave desconocida", (await verificarCertificado(`${otroKid}.${certificado.split(".")[1]}.${firma}`, CLAVES_PUBLICAS_LICENCIA)) === null);

const sinFirma = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT", kid: clave.kid })).toString("base64url");
comprobar('Rechaza "alg: none"', (await verificarCertificado(`${sinFirma}.${certificado.split(".")[1]}.`, CLAVES_PUBLICAS_LICENCIA)) === null);

comprobar("Rechaza basura", (await verificarCertificado("no.es.unjwt", CLAVES_PUBLICAS_LICENCIA)) === null);

process.exit(fallas ? 1 : 0);
