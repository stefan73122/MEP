// Paso posterior a `next build`: ofusca los chunks JS ya compilados en
// out/_next/static/chunks antes de que `cap sync` los copie al APK.
//
// No se toca la configuración del bundler (el proyecto usa Turbopack, que
// no tiene un equivalente directo al plugin de ofuscación de Webpack): se
// transforma el archivo YA generado, después de que Next terminó de armarlo.
//
// Deliberadamente NO toca _buildManifest.js / _ssgManifest.js /
// _clientMiddlewareManifest.js: son metadata de enrutamiento que Next lee
// con una forma exacta, no código de la app — ofuscarlos no aporta nada y
// arriesga romper la navegación.
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import JavaScriptObfuscator from "javascript-obfuscator";

const CARPETA_CHUNKS = path.join(import.meta.dirname, "..", "out", "_next", "static", "chunks");

// Deliberadamente SIN controlFlowFlattening ni deadCodeInjection: son las
// transformaciones más agresivas del ofuscador y las que más rompen apps
// reales en producción (código async/generators, WebAssembly como el que
// usa sql.js acá) — un bug ahí deja el APK entero inutilizable para el
// cliente. Con esto los nombres de función/variable quedan ilegibles (pedido
// original) sin arriesgar el comportamiento en tiempo de ejecución.
const OPCIONES = {
  compact: true,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  identifierNamesGenerator: "hexadecimal",
  renameGlobals: false,
  selfDefending: false,
  stringArray: true,
  stringArrayEncoding: ["base64"],
  stringArrayThreshold: 0.75,
  numbersToExpressions: false,
  splitStrings: false,
  transformObjectKeys: false,
};

async function listarArchivosJs(carpeta) {
  const entradas = await readdir(carpeta, { withFileTypes: true });
  const archivos = [];
  for (const entrada of entradas) {
    const rutaCompleta = path.join(carpeta, entrada.name);
    if (entrada.isDirectory()) {
      archivos.push(...(await listarArchivosJs(rutaCompleta)));
    } else if (entrada.name.endsWith(".js")) {
      archivos.push(rutaCompleta);
    }
  }
  return archivos;
}

async function ofuscarArchivo(ruta) {
  const codigoOriginal = await readFile(ruta, "utf8");
  const resultado = JavaScriptObfuscator.obfuscate(codigoOriginal, OPCIONES);
  await writeFile(ruta, resultado.getObfuscatedCode(), "utf8");
}

async function main() {
  const archivos = await listarArchivosJs(CARPETA_CHUNKS);
  console.log(`Ofuscando ${archivos.length} archivos JS en ${CARPETA_CHUNKS}...`);
  for (const archivo of archivos) {
    await ofuscarArchivo(archivo);
  }
  console.log("Listo.");
}

main().catch((error) => {
  console.error("Falló la ofuscación del build:", error);
  process.exit(1);
});
