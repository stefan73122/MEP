import { Capacitor } from "@capacitor/core";
import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from "@capacitor-community/sqlite";
import { Directory, Filesystem } from "@capacitor/filesystem";

const NOMBRE_DB = "tienda";

const ESQUEMA = `
CREATE TABLE IF NOT EXISTS Configuracion (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombreNegocio TEXT NOT NULL,
  moneda TEXT NOT NULL DEFAULT 'BOB',
  simboloMoneda TEXT NOT NULL DEFAULT 'Bs',
  pinHash TEXT,
  diasAlertaVencimiento INTEGER NOT NULL DEFAULT 30,
  bloqueoActivado INTEGER NOT NULL DEFAULT 0,
  huellaActivada INTEGER NOT NULL DEFAULT 0,
  licenciaActivada INTEGER NOT NULL DEFAULT 0,
  licenciaCodigoDispositivo TEXT,
  updatedAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS Producto (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  categoria TEXT,
  unidadMedida TEXT NOT NULL DEFAULT 'unidad',
  factorConversion INTEGER NOT NULL DEFAULT 1,
  precioCompra INTEGER NOT NULL,
  precioVenta INTEGER NOT NULL,
  perecedero INTEGER NOT NULL DEFAULT 0,
  stockActual INTEGER NOT NULL DEFAULT 0,
  stockMinimo INTEGER NOT NULL DEFAULT 0,
  activo INTEGER NOT NULL DEFAULT 1,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_producto_nombre ON Producto (nombre);

CREATE TABLE IF NOT EXISTS Lote (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  productoId INTEGER NOT NULL REFERENCES Producto(id),
  cantidad INTEGER NOT NULL,
  fechaVencimiento INTEGER NOT NULL,
  createdAt INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_lote_producto_vencimiento ON Lote (productoId, fechaVencimiento);

CREATE TABLE IF NOT EXISTS MovimientoInventario (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  productoId INTEGER NOT NULL REFERENCES Producto(id),
  loteId INTEGER REFERENCES Lote(id),
  tipo TEXT NOT NULL,
  cantidad INTEGER NOT NULL,
  stockAnterior INTEGER NOT NULL,
  stockPosterior INTEGER NOT NULL,
  motivo TEXT NOT NULL,
  ventaId INTEGER REFERENCES Venta(id),
  createdAt INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_movimiento_producto ON MovimientoInventario (productoId);
CREATE INDEX IF NOT EXISTS idx_movimiento_createdAt ON MovimientoInventario (createdAt);

CREATE TABLE IF NOT EXISTS Cliente (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  telefono TEXT,
  limiteCredito INTEGER NOT NULL DEFAULT 0,
  activo INTEGER NOT NULL DEFAULT 1,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cliente_nombre ON Cliente (nombre);

CREATE TABLE IF NOT EXISTS Venta (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  clienteId INTEGER REFERENCES Cliente(id),
  fecha INTEGER NOT NULL,
  subtotal INTEGER NOT NULL,
  descuento INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL,
  formaPago TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'COMPLETADA',
  motivoAnulacion TEXT,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_venta_fecha ON Venta (fecha);
CREATE INDEX IF NOT EXISTS idx_venta_cliente ON Venta (clienteId);
CREATE INDEX IF NOT EXISTS idx_venta_estado ON Venta (estado);

CREATE TABLE IF NOT EXISTS VentaItem (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ventaId INTEGER NOT NULL REFERENCES Venta(id),
  productoId INTEGER NOT NULL REFERENCES Producto(id),
  cantidad INTEGER NOT NULL,
  precioUnitario INTEGER NOT NULL,
  descuento INTEGER NOT NULL DEFAULT 0,
  subtotal INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ventaitem_venta ON VentaItem (ventaId);
CREATE INDEX IF NOT EXISTS idx_ventaitem_producto ON VentaItem (productoId);

CREATE TABLE IF NOT EXISTS Pago (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  clienteId INTEGER NOT NULL REFERENCES Cliente(id),
  monto INTEGER NOT NULL,
  fecha INTEGER NOT NULL,
  observacion TEXT,
  createdAt INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pago_cliente ON Pago (clienteId);

CREATE TABLE IF NOT EXISTS PagoVenta (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pagoId INTEGER NOT NULL REFERENCES Pago(id),
  ventaId INTEGER NOT NULL REFERENCES Venta(id),
  montoAplicado INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pagoventa_pago ON PagoVenta (pagoId);
CREATE INDEX IF NOT EXISTS idx_pagoventa_venta ON PagoVenta (ventaId);

CREATE TABLE IF NOT EXISTS Gasto (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  monto INTEGER NOT NULL,
  descripcion TEXT NOT NULL,
  fecha INTEGER NOT NULL,
  createdAt INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_gasto_fecha ON Gasto (fecha);

CREATE TABLE IF NOT EXISTS AuditLog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entidad TEXT NOT NULL,
  entidadId INTEGER NOT NULL,
  accion TEXT NOT NULL,
  detalle TEXT,
  createdAt INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auditlog_entidad ON AuditLog (entidad, entidadId);
`;

// ---------------------------------------------------------------------------
// Migraciones
//
// La versión del esquema se guarda en la propia base (PRAGMA user_version).
// Las instalaciones anteriores a este sistema están en 0. Cada migración es
// SOLO aditiva: crea tablas nuevas (IF NOT EXISTS) y agrega columnas que
// falten, revisando antes con PRAGMA table_info si ya existen (hay
// instalaciones con columnas agregadas a mano por versiones anteriores).
// Nunca borra ni reescribe tablas ni filas existentes.
//
// Orden en una actualización: 1) respaldo completo del archivo de la base
// (si falla, NO se migra y la app muestra el error); 2) migración dentro de
// una transacción: o se aplica todo, o nada.
// ---------------------------------------------------------------------------

export const VERSION_ESQUEMA = 1;

// Versión 1: tipo de negocio (tienda / servicios), servicios y atenciones.
const TABLAS_V1 = `
CREATE TABLE IF NOT EXISTS Servicio (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  precio INTEGER NOT NULL,
  duracionMinutos INTEGER,
  descripcion TEXT,
  activo INTEGER NOT NULL DEFAULT 1,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_servicio_nombre ON Servicio (nombre);

CREATE TABLE IF NOT EXISTS VentaServicio (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ventaId INTEGER NOT NULL REFERENCES Venta(id),
  servicioId INTEGER NOT NULL REFERENCES Servicio(id),
  cantidad INTEGER NOT NULL DEFAULT 1,
  precioUnitario INTEGER NOT NULL,
  descuento INTEGER NOT NULL DEFAULT 0,
  subtotal INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ventaservicio_venta ON VentaServicio (ventaId);
CREATE INDEX IF NOT EXISTS idx_ventaservicio_servicio ON VentaServicio (servicioId);
`;

// Toda columna agregada después del CREATE TABLE original, de cualquier
// versión: se agrega solo si falta.
const COLUMNAS_REQUERIDAS: { tabla: string; columna: string; definicion: string }[] = [
  { tabla: "Configuracion", columna: "bloqueoActivado", definicion: "INTEGER NOT NULL DEFAULT 0" },
  { tabla: "Configuracion", columna: "huellaActivada", definicion: "INTEGER NOT NULL DEFAULT 0" },
  { tabla: "Configuracion", columna: "licenciaActivada", definicion: "INTEGER NOT NULL DEFAULT 0" },
  { tabla: "Configuracion", columna: "licenciaCodigoDispositivo", definicion: "TEXT" },
  { tabla: "Configuracion", columna: "tipoNegocio", definicion: "TEXT" },
  { tabla: "Configuracion", columna: "onboardingVersion", definicion: "INTEGER" },
  { tabla: "Venta", columna: "nota", definicion: "TEXT" },
];

async function leerVersionEsquema(conexion: SQLiteDBConnection): Promise<number> {
  const resultado = await conexion.query("PRAGMA user_version;");
  const fila = resultado.values?.[0] as { user_version?: number } | undefined;
  return Number(fila?.user_version ?? 0);
}

async function existeTabla(conexion: SQLiteDBConnection, tabla: string): Promise<boolean> {
  const resultado = await conexion.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?;", [tabla]);
  return (resultado.values ?? []).length > 0;
}

async function columnasDe(conexion: SQLiteDBConnection, tabla: string): Promise<Set<string>> {
  const info = await conexion.query(`PRAGMA table_info(${tabla});`);
  return new Set((info.values ?? []).map((fila) => fila.name as string));
}

const CARPETA_RESPALDOS = "respaldos";
const RESPALDOS_A_CONSERVAR = 3;

async function verificarRespaldo(ruta: string): Promise<boolean> {
  try {
    const info = await Filesystem.stat({ path: ruta, directory: Directory.Data });
    return info.size > 0;
  } catch {
    return false;
  }
}

function mensajeDe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// Copia completa de la base a <datos de la app>/respaldos/. Primero con
// VACUUM INTO (copia consistente hecha por el propio SQLite); si este motor
// no lo soporta, copiando el archivo tal cual. En los dos casos se comprueba
// que el respaldo exista y no esté vacío: si no, se lanza un error y la
// migración no se hace.
async function respaldarBase(conexion: SQLiteDBConnection, versionPrevia: number): Promise<void> {
  try {
    await Filesystem.mkdir({ path: CARPETA_RESPALDOS, directory: Directory.Data, recursive: true });
  } catch {
    // Ya existía: si fuera otro problema, el respaldo de abajo va a fallar igual.
  }

  const nombre = `${NOMBRE_DB}-v${versionPrevia}-a-v${VERSION_ESQUEMA}-${Date.now()}.db`;
  const rutaRelativa = `${CARPETA_RESPALDOS}/${nombre}`;
  const { uri } = await Filesystem.getUri({ path: rutaRelativa, directory: Directory.Data });
  const rutaAbsoluta = decodeURIComponent(uri.replace(/^file:\/\//, ""));

  let errorVacuum: unknown = null;
  try {
    await conexion.execute(`VACUUM INTO '${rutaAbsoluta.replace(/'/g, "''")}';`, false);
  } catch (error) {
    errorVacuum = error;
  }

  if (!(await verificarRespaldo(rutaRelativa))) {
    // Plan B: copiar el archivo de la base. Antes se vuelca el WAL (si lo
    // hay) al archivo principal, para que la copia tenga todo.
    try {
      await conexion.query("PRAGMA wal_checkpoint(TRUNCATE);");
    } catch {
      // Sin WAL: no hay nada que volcar.
    }
    const { uri: uriDatos } = await Filesystem.getUri({ path: "", directory: Directory.Data });
    const uriBase = uriDatos.replace(/\/files\/?$/, "") + `/databases/${NOMBRE_DB}SQLite.db`;
    try {
      await Filesystem.copy({ from: uriBase, to: rutaRelativa, toDirectory: Directory.Data });
    } catch (errorCopia) {
      throw new Error(`VACUUM INTO: ${mensajeDe(errorVacuum)} · copia: ${mensajeDe(errorCopia)}`);
    }
    if (!(await verificarRespaldo(rutaRelativa))) {
      throw new Error("el archivo de respaldo quedó vacío");
    }
  }

  // Limpieza: solo los últimos respaldos (los nombres llevan la fecha, así
  // que el orden alfabético es el cronológico). Si falla, no importa.
  try {
    const { files } = await Filesystem.readdir({ path: CARPETA_RESPALDOS, directory: Directory.Data });
    const respaldos = files
      .map((f) => f.name)
      .filter((n) => n.endsWith(".db"))
      .sort();
    for (const viejo of respaldos.slice(0, Math.max(0, respaldos.length - RESPALDOS_A_CONSERVAR))) {
      await Filesystem.deleteFile({ path: `${CARPETA_RESPALDOS}/${viejo}`, directory: Directory.Data });
    }
  } catch {
    // Limpieza opcional.
  }
}

async function migrar(conexion: SQLiteDBConnection): Promise<void> {
  // `false` en cada execute: la transacción la maneja esta función (si no,
  // el plugin abre una propia por sentencia y el BEGIN de acá se anida).
  await conexion.execute("BEGIN TRANSACTION;", false);
  try {
    await conexion.execute(ESQUEMA, false);
    await conexion.execute(TABLAS_V1, false);

    const columnasPorTabla = new Map<string, Set<string>>();
    for (const { tabla, columna, definicion } of COLUMNAS_REQUERIDAS) {
      if (!columnasPorTabla.has(tabla)) columnasPorTabla.set(tabla, await columnasDe(conexion, tabla));
      const columnas = columnasPorTabla.get(tabla)!;
      if (columnas.has(columna)) continue;
      await conexion.execute(`ALTER TABLE ${tabla} ADD COLUMN ${columna} ${definicion};`, false);
      columnas.add(columna);
    }

    await conexion.execute(`PRAGMA user_version = ${VERSION_ESQUEMA};`, false);
    await conexion.execute("COMMIT TRANSACTION;", false);
  } catch (error) {
    await conexion.execute("ROLLBACK TRANSACTION;", false).catch(() => {});
    throw error;
  }
}

let promesaConexion: Promise<SQLiteDBConnection> | null = null;

// Una sola instancia para toda la app: SQLiteConnection guarda en memoria (en
// JS) qué conexiones creó, y isConnection/retrieveConnection solo miran ese
// registro. Con una instancia nueva por intento, el registro siempre estaba
// vacío y se volvía a llamar a createConnection sobre una conexión nativa que
// seguía abierta ("Connection tienda already exists").
const sqlite = new SQLiteConnection(CapacitorSQLite);
let storeWebListo = false;

async function prepararStoreWeb(): Promise<void> {
  if (storeWebListo) return;
  // En el navegador (desarrollo) se usa el store basado en jeep-sqlite +
  // IndexedDB; en el APK real, el plugin usa SQLite nativo directamente.
  // OJO: hay que importar "jeep-sqlite/loader" (no "jeep-sqlite" a secas):
  // el paquete principal no registra el custom element por sí solo.
  const { defineCustomElements } = await import("jeep-sqlite/loader");
  defineCustomElements(window);
  if (!document.querySelector("jeep-sqlite")) {
    document.body.appendChild(document.createElement("jeep-sqlite"));
  }
  await customElements.whenDefined("jeep-sqlite");
  await sqlite.initWebStore();
  storeWebListo = true;
}

// Obtiene la conexión a la base reutilizando la nativa si ya existe.
//
// Cuando Android recarga la vista web (por ejemplo, al volver de segundo
// plano después de liberar memoria), todo el JavaScript arranca de cero pero
// la conexión nativa sigue abierta. checkConnectionsConsistency() compara las
// dos listas y cierra del lado nativo las que JS ya no conoce; después de eso,
// crear la conexión vuelve a ser seguro. Si JS sí la conoce (por ejemplo, al
// tocar "Reintentar"), se reutiliza la misma, abriéndola solo si está cerrada.
async function conectar(): Promise<SQLiteDBConnection> {
  try {
    await sqlite.checkConnectionsConsistency();
  } catch {
    // Sin conexiones previas que comparar: no hay nada que corregir.
  }

  const yaExiste = (await sqlite.isConnection(NOMBRE_DB, false)).result;
  const conexion = yaExiste
    ? await sqlite.retrieveConnection(NOMBRE_DB, false)
    : await sqlite.createConnection(NOMBRE_DB, false, "no-encryption", 1, false);

  const abierta = (await conexion.isDBOpen()).result;
  if (!abierta) await conexion.open();
  return conexion;
}

async function abrirConexion(): Promise<SQLiteDBConnection> {
  const esWeb = Capacitor.getPlatform() === "web";
  if (esWeb) await prepararStoreWeb();

  const conexion = await conectar();

  // La migración depende de user_version guardado en la propia base, no de si
  // la conexión es nueva o reutilizada: corre una sola vez por base. Si falla
  // (o falla el respaldo previo), la conexión queda abierta tal cual y el
  // próximo intento la reutiliza; la transacción ya se deshizo en migrar().
  const version = await leerVersionEsquema(conexion);
  if (version < VERSION_ESQUEMA) {
    // Instalación nueva (base vacía): no hay nada que respaldar. En web
    // (solo desarrollo) la base vive en IndexedDB y no hay archivo.
    const hayDatosPrevios = await existeTabla(conexion, "Configuracion");
    if (hayDatosPrevios && !esWeb) {
      try {
        await respaldarBase(conexion, version);
      } catch (error) {
        throw new Error(
          "No se pudo hacer el respaldo de tus datos antes de actualizar, así que no se modificó nada. " +
            `Detalle: ${mensajeDe(error)}`,
        );
      }
    }
    await migrar(conexion);
    if (esWeb) {
      await sqlite.saveToStore(NOMBRE_DB);
    }
  }

  return conexion;
}

// Conexión única para toda la vida de la app (sistema de un solo usuario,
// sin necesidad de manejar conexiones concurrentes). Todas las llamadas
// comparten la misma promesa: aunque React monte dos veces o se toque
// "Reintentar" varias veces seguidas, la base se inicializa una sola vez a la
// vez. Si falla (por ejemplo, el respaldo previo a una migración), no se
// guarda el fallo: el próximo intento vuelve a probar con la misma lógica.
export function obtenerConexion(): Promise<SQLiteDBConnection> {
  if (!promesaConexion) {
    promesaConexion = abrirConexion().catch((error) => {
      promesaConexion = null;
      throw error;
    });
  }
  return promesaConexion;
}

export async function persistirCambios(): Promise<void> {
  if (Capacitor.getPlatform() !== "web") return;
  await sqlite.saveToStore(NOMBRE_DB);
}
