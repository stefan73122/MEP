import { Capacitor } from "@capacitor/core";
import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from "@capacitor-community/sqlite";

const NOMBRE_DB = "tienda";

const ESQUEMA = `
CREATE TABLE IF NOT EXISTS Configuracion (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombreNegocio TEXT NOT NULL,
  moneda TEXT NOT NULL DEFAULT 'BOB',
  simboloMoneda TEXT NOT NULL DEFAULT 'Bs',
  pinHash TEXT,
  diasAlertaVencimiento INTEGER NOT NULL DEFAULT 30,
  updatedAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS Producto (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT NOT NULL UNIQUE,
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

let promesaConexion: Promise<SQLiteDBConnection> | null = null;

async function abrirConexion(): Promise<SQLiteDBConnection> {
  const sqlite = new SQLiteConnection(CapacitorSQLite);
  const esWeb = Capacitor.getPlatform() === "web";

  if (esWeb) {
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
  }

  const yaExiste = (await sqlite.isConnection(NOMBRE_DB, false)).result;
  const conexion = yaExiste
    ? await sqlite.retrieveConnection(NOMBRE_DB, false)
    : await sqlite.createConnection(NOMBRE_DB, false, "no-encryption", 1, false);

  await conexion.open();
  await conexion.execute(ESQUEMA);
  if (esWeb) {
    await sqlite.saveToStore(NOMBRE_DB);
  }

  return conexion;
}

// Conexión única para toda la vida de la app (sistema de un solo usuario,
// sin necesidad de manejar conexiones concurrentes).
export function obtenerConexion(): Promise<SQLiteDBConnection> {
  if (!promesaConexion) {
    promesaConexion = abrirConexion();
  }
  return promesaConexion;
}

export async function persistirCambios(): Promise<void> {
  if (Capacitor.getPlatform() !== "web") return;
  const sqlite = new SQLiteConnection(CapacitorSQLite);
  await sqlite.saveToStore(NOMBRE_DB);
}
