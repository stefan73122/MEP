import { obtenerConexion, persistirCambios } from "./sqlite";
import {
  ErrorRestriccionUnica,
  type AccionAuditoria,
  type Cliente,
  type Configuracion,
  type FormaPago,
  type Gasto,
  type Lote,
  type LoteConProducto,
  type MovimientoInventario,
  type Pago,
  type PagoVenta,
  type Producto,
  type TipoMovimiento,
  type Venta,
  type VentaConCliente,
  type VentaConPagos,
  type VentaDetalle,
  type VentaItemConProducto,
} from "./types";

async function ejecutar(sql: string, params: unknown[] = []): Promise<{ lastId: number; changes: number }> {
  const conexion = await obtenerConexion();
  try {
    const resultado = await conexion.run(sql, params, false);
    return {
      lastId: resultado.changes?.lastId ?? 0,
      changes: resultado.changes?.changes ?? 0,
    };
  } catch (error) {
    if (error instanceof Error && /UNIQUE constraint failed/i.test(error.message)) {
      throw new ErrorRestriccionUnica(error.message);
    }
    throw error;
  }
}

async function consultar<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const conexion = await obtenerConexion();
  const resultado = await conexion.query(sql, params);
  return (resultado.values ?? []) as T[];
}

const b = (valor: boolean): number => (valor ? 1 : 0);

// ---------------------------------------------------------------------------
// Mapeo de filas (SQLite no tiene booleanos ni fechas nativas: se guardan
// como 0/1 y epoch ms respectivamente).
// ---------------------------------------------------------------------------

type FilaProducto = {
  id: number; sku: string; nombre: string; categoria: string | null; unidadMedida: string;
  factorConversion: number; precioCompra: number; precioVenta: number; perecedero: number;
  stockActual: number; stockMinimo: number; activo: number; createdAt: number; updatedAt: number;
};
function mapProducto(f: FilaProducto): Producto {
  return {
    ...f,
    perecedero: !!f.perecedero,
    activo: !!f.activo,
    createdAt: new Date(f.createdAt),
    updatedAt: new Date(f.updatedAt),
  };
}

type FilaLote = { id: number; productoId: number; cantidad: number; fechaVencimiento: number; createdAt: number };
function mapLote(f: FilaLote): Lote {
  return { ...f, fechaVencimiento: new Date(f.fechaVencimiento), createdAt: new Date(f.createdAt) };
}

type FilaMovimiento = {
  id: number; productoId: number; loteId: number | null; tipo: TipoMovimiento; cantidad: number;
  stockAnterior: number; stockPosterior: number; motivo: string; ventaId: number | null; createdAt: number;
};
function mapMovimiento(f: FilaMovimiento): MovimientoInventario {
  return { ...f, createdAt: new Date(f.createdAt) };
}

type FilaCliente = {
  id: number; nombre: string; telefono: string | null; limiteCredito: number; activo: number;
  createdAt: number; updatedAt: number;
};
function mapCliente(f: FilaCliente): Cliente {
  return { ...f, activo: !!f.activo, createdAt: new Date(f.createdAt), updatedAt: new Date(f.updatedAt) };
}

type FilaVenta = {
  id: number; clienteId: number | null; fecha: number; subtotal: number; descuento: number; total: number;
  formaPago: FormaPago; estado: "COMPLETADA" | "ANULADA"; motivoAnulacion: string | null;
  createdAt: number; updatedAt: number;
};
function mapVenta(f: FilaVenta): Venta {
  return { ...f, fecha: new Date(f.fecha), createdAt: new Date(f.createdAt), updatedAt: new Date(f.updatedAt) };
}

type FilaPago = { id: number; clienteId: number; monto: number; fecha: number; observacion: string | null; createdAt: number };
function mapPago(f: FilaPago): Pago {
  return { ...f, fecha: new Date(f.fecha), createdAt: new Date(f.createdAt) };
}

type FilaGasto = { id: number; monto: number; descripcion: string; fecha: number; createdAt: number };
function mapGasto(f: FilaGasto): Gasto {
  return { ...f, fecha: new Date(f.fecha), createdAt: new Date(f.createdAt) };
}

type FilaConfiguracion = {
  id: number; nombreNegocio: string; moneda: string; simboloMoneda: string; pinHash: string | null;
  diasAlertaVencimiento: number; updatedAt: number;
};
function mapConfiguracion(f: FilaConfiguracion): Configuracion {
  return { ...f, updatedAt: new Date(f.updatedAt) };
}

// ---------------------------------------------------------------------------
// Producto
// ---------------------------------------------------------------------------

const producto = {
  async findMany(where?: { activo?: boolean; skuIn?: string[]; idIn?: number[] }): Promise<Producto[]> {
    const condiciones: string[] = [];
    const params: unknown[] = [];
    if (where?.activo !== undefined) {
      condiciones.push("activo = ?");
      params.push(b(where.activo));
    }
    if (where?.skuIn && where.skuIn.length > 0) {
      condiciones.push(`sku IN (${where.skuIn.map(() => "?").join(",")})`);
      params.push(...where.skuIn);
    }
    if (where?.idIn) {
      if (where.idIn.length === 0) return [];
      condiciones.push(`id IN (${where.idIn.map(() => "?").join(",")})`);
      params.push(...where.idIn);
    }
    const sql = `SELECT * FROM Producto${condiciones.length ? ` WHERE ${condiciones.join(" AND ")}` : ""}`;
    const filas = await consultar<FilaProducto>(sql, params);
    return filas.map(mapProducto);
  },

  async findUnique(id: number): Promise<Producto | null> {
    const filas = await consultar<FilaProducto>("SELECT * FROM Producto WHERE id = ?", [id]);
    return filas[0] ? mapProducto(filas[0]) : null;
  },

  async findBySku(sku: string): Promise<Producto | null> {
    const filas = await consultar<FilaProducto>("SELECT * FROM Producto WHERE sku = ?", [sku]);
    return filas[0] ? mapProducto(filas[0]) : null;
  },

  async create(data: {
    sku: string; nombre: string; categoria?: string | null; unidadMedida: string; factorConversion: number;
    precioCompra: number; precioVenta: number; perecedero?: boolean; stockActual?: number; stockMinimo: number;
  }): Promise<Producto> {
    const ahora = Date.now();
    const { lastId } = await ejecutar(
      `INSERT INTO Producto
        (sku, nombre, categoria, unidadMedida, factorConversion, precioCompra, precioVenta, perecedero, stockActual, stockMinimo, activo, createdAt, updatedAt)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        data.sku, data.nombre, data.categoria ?? null, data.unidadMedida, data.factorConversion,
        data.precioCompra, data.precioVenta, b(data.perecedero ?? false), data.stockActual ?? 0,
        data.stockMinimo, 1, ahora, ahora,
      ],
    );
    const creado = await producto.findUnique(lastId);
    if (!creado) throw new Error("No se pudo leer el producto recién creado");
    return creado;
  },

  async update(
    id: number,
    data: Partial<{
      nombre: string; categoria: string | null; precioCompra: number; precioVenta: number;
      stockMinimo: number; stockActual: number; activo: boolean;
    }>,
  ): Promise<void> {
    const campos: string[] = [];
    const params: unknown[] = [];
    if (data.nombre !== undefined) { campos.push("nombre = ?"); params.push(data.nombre); }
    if (data.categoria !== undefined) { campos.push("categoria = ?"); params.push(data.categoria); }
    if (data.precioCompra !== undefined) { campos.push("precioCompra = ?"); params.push(data.precioCompra); }
    if (data.precioVenta !== undefined) { campos.push("precioVenta = ?"); params.push(data.precioVenta); }
    if (data.stockMinimo !== undefined) { campos.push("stockMinimo = ?"); params.push(data.stockMinimo); }
    if (data.stockActual !== undefined) { campos.push("stockActual = ?"); params.push(data.stockActual); }
    if (data.activo !== undefined) { campos.push("activo = ?"); params.push(b(data.activo)); }
    campos.push("updatedAt = ?");
    params.push(Date.now());
    params.push(id);
    await ejecutar(`UPDATE Producto SET ${campos.join(", ")} WHERE id = ?`, params);
  },
};

// ---------------------------------------------------------------------------
// Lote
// ---------------------------------------------------------------------------

const lote = {
  async findVendibles(productoId: number, ahora: Date): Promise<Lote[]> {
    const filas = await consultar<FilaLote>(
      `SELECT * FROM Lote WHERE productoId = ? AND cantidad > 0 AND fechaVencimiento >= ? ORDER BY fechaVencimiento ASC`,
      [productoId, ahora.getTime()],
    );
    return filas.map(mapLote);
  },

  async findVencidos(ahora: Date): Promise<LoteConProducto[]> {
    const filas = await consultar<FilaLote & { pNombre: string; pUnidad: string; pFactor: number; pActivo: number }>(
      `SELECT l.*, p.nombre as pNombre, p.unidadMedida as pUnidad, p.factorConversion as pFactor, p.activo as pActivo
       FROM Lote l JOIN Producto p ON p.id = l.productoId
       WHERE l.cantidad > 0 AND l.fechaVencimiento < ? AND p.activo = 1
       ORDER BY l.fechaVencimiento ASC`,
      [ahora.getTime()],
    );
    return filas.map((f) => ({
      ...mapLote(f),
      producto: { nombre: f.pNombre, unidadMedida: f.pUnidad, factorConversion: f.pFactor, activo: !!f.pActivo },
    }));
  },

  async findPorVencer(ahora: Date, diasAlerta: number): Promise<LoteConProducto[]> {
    const limite = ahora.getTime() + diasAlerta * 24 * 60 * 60 * 1000;
    const filas = await consultar<FilaLote & { pNombre: string; pUnidad: string; pFactor: number; pActivo: number }>(
      `SELECT l.*, p.nombre as pNombre, p.unidadMedida as pUnidad, p.factorConversion as pFactor, p.activo as pActivo
       FROM Lote l JOIN Producto p ON p.id = l.productoId
       WHERE l.cantidad > 0 AND l.fechaVencimiento >= ? AND l.fechaVencimiento <= ? AND p.activo = 1
       ORDER BY l.fechaVencimiento ASC`,
      [ahora.getTime(), limite],
    );
    return filas.map((f) => ({
      ...mapLote(f),
      producto: { nombre: f.pNombre, unidadMedida: f.pUnidad, factorConversion: f.pFactor, activo: !!f.pActivo },
    }));
  },

  async findByProducto(productoId: number): Promise<Lote[]> {
    const filas = await consultar<FilaLote>(
      `SELECT * FROM Lote WHERE productoId = ? AND cantidad > 0 ORDER BY fechaVencimiento ASC`,
      [productoId],
    );
    return filas.map(mapLote);
  },

  async findUnique(id: number): Promise<(Lote & { producto: Producto }) | null> {
    const filas = await consultar<FilaLote>("SELECT * FROM Lote WHERE id = ?", [id]);
    if (!filas[0]) return null;
    const p = await producto.findUnique(filas[0].productoId);
    if (!p) return null;
    return { ...mapLote(filas[0]), producto: p };
  },

  async create(data: { productoId: number; cantidad: number; fechaVencimiento: Date }): Promise<Lote> {
    const { lastId } = await ejecutar(
      `INSERT INTO Lote (productoId, cantidad, fechaVencimiento, createdAt) VALUES (?,?,?,?)`,
      [data.productoId, data.cantidad, data.fechaVencimiento.getTime(), Date.now()],
    );
    const filas = await consultar<FilaLote>("SELECT * FROM Lote WHERE id = ?", [lastId]);
    return mapLote(filas[0]);
  },

  async update(id: number, data: { cantidad: number }): Promise<void> {
    await ejecutar("UPDATE Lote SET cantidad = ? WHERE id = ?", [data.cantidad, id]);
  },
};

// ---------------------------------------------------------------------------
// MovimientoInventario
// ---------------------------------------------------------------------------

const movimientoInventario = {
  async create(data: {
    productoId: number; loteId?: number | null; tipo: TipoMovimiento; cantidad: number;
    stockAnterior: number; stockPosterior: number; motivo: string; ventaId?: number | null;
  }): Promise<MovimientoInventario> {
    const { lastId } = await ejecutar(
      `INSERT INTO MovimientoInventario
        (productoId, loteId, tipo, cantidad, stockAnterior, stockPosterior, motivo, ventaId, createdAt)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        data.productoId, data.loteId ?? null, data.tipo, data.cantidad, data.stockAnterior,
        data.stockPosterior, data.motivo, data.ventaId ?? null, Date.now(),
      ],
    );
    const filas = await consultar<FilaMovimiento>("SELECT * FROM MovimientoInventario WHERE id = ?", [lastId]);
    return mapMovimiento(filas[0]);
  },

  async findByProducto(productoId: number, take = 20): Promise<MovimientoInventario[]> {
    const filas = await consultar<FilaMovimiento>(
      "SELECT * FROM MovimientoInventario WHERE productoId = ? ORDER BY createdAt DESC LIMIT ?",
      [productoId, take],
    );
    return filas.map(mapMovimiento);
  },

  async findSalidasDeVenta(ventaId: number, productoId: number): Promise<MovimientoInventario[]> {
    const filas = await consultar<FilaMovimiento>(
      `SELECT * FROM MovimientoInventario
       WHERE ventaId = ? AND productoId = ? AND tipo = 'SALIDA' AND loteId IS NOT NULL`,
      [ventaId, productoId],
    );
    return filas.map(mapMovimiento);
  },
};

// ---------------------------------------------------------------------------
// Cliente
// ---------------------------------------------------------------------------

const cliente = {
  async findMany(where?: { activo?: boolean }, orderByNombre = false): Promise<Cliente[]> {
    const condiciones: string[] = [];
    const params: unknown[] = [];
    if (where?.activo !== undefined) {
      condiciones.push("activo = ?");
      params.push(b(where.activo));
    }
    const sql = `SELECT * FROM Cliente${condiciones.length ? ` WHERE ${condiciones.join(" AND ")}` : ""}${
      orderByNombre ? " ORDER BY nombre ASC" : ""
    }`;
    const filas = await consultar<FilaCliente>(sql, params);
    return filas.map(mapCliente);
  },

  async findUnique(id: number): Promise<Cliente | null> {
    const filas = await consultar<FilaCliente>("SELECT * FROM Cliente WHERE id = ?", [id]);
    return filas[0] ? mapCliente(filas[0]) : null;
  },

  async create(data: { nombre: string; telefono?: string | null; limiteCredito: number }): Promise<Cliente> {
    const ahora = Date.now();
    const { lastId } = await ejecutar(
      "INSERT INTO Cliente (nombre, telefono, limiteCredito, activo, createdAt, updatedAt) VALUES (?,?,?,?,?,?)",
      [data.nombre, data.telefono ?? null, data.limiteCredito, 1, ahora, ahora],
    );
    const filas = await consultar<FilaCliente>("SELECT * FROM Cliente WHERE id = ?", [lastId]);
    return mapCliente(filas[0]);
  },

  async update(
    id: number,
    data: Partial<{ nombre: string; telefono: string | null; limiteCredito: number; activo: boolean }>,
  ): Promise<void> {
    const campos: string[] = [];
    const params: unknown[] = [];
    if (data.nombre !== undefined) { campos.push("nombre = ?"); params.push(data.nombre); }
    if (data.telefono !== undefined) { campos.push("telefono = ?"); params.push(data.telefono); }
    if (data.limiteCredito !== undefined) { campos.push("limiteCredito = ?"); params.push(data.limiteCredito); }
    if (data.activo !== undefined) { campos.push("activo = ?"); params.push(b(data.activo)); }
    campos.push("updatedAt = ?");
    params.push(Date.now());
    params.push(id);
    await ejecutar(`UPDATE Cliente SET ${campos.join(", ")} WHERE id = ?`, params);
  },
};

// ---------------------------------------------------------------------------
// Venta
// ---------------------------------------------------------------------------

type FiltroVenta = {
  id?: number; clienteId?: number | null; formaPago?: FormaPago; estado?: "COMPLETADA" | "ANULADA";
  fechaGte?: Date; fechaLte?: Date;
};

function construirWhereVenta(filtro: FiltroVenta): { sql: string; params: unknown[] } {
  const condiciones: string[] = [];
  const params: unknown[] = [];
  if (filtro.id !== undefined) { condiciones.push("id = ?"); params.push(filtro.id); }
  if (filtro.clienteId !== undefined) { condiciones.push("clienteId = ?"); params.push(filtro.clienteId); }
  if (filtro.formaPago !== undefined) { condiciones.push("formaPago = ?"); params.push(filtro.formaPago); }
  if (filtro.estado !== undefined) { condiciones.push("estado = ?"); params.push(filtro.estado); }
  if (filtro.fechaGte) { condiciones.push("fecha >= ?"); params.push(filtro.fechaGte.getTime()); }
  if (filtro.fechaLte) { condiciones.push("fecha <= ?"); params.push(filtro.fechaLte.getTime()); }
  return { sql: condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "", params };
}

const venta = {
  async findMany(
    filtro: FiltroVenta,
    opciones?: { orderBy?: "asc" | "desc"; take?: number },
  ): Promise<Venta[]> {
    const { sql: where, params } = construirWhereVenta(filtro);
    const orden = opciones?.orderBy === "asc" ? "ASC" : "DESC";
    const limite = opciones?.take ? ` LIMIT ${opciones.take}` : "";
    const filas = await consultar<FilaVenta>(
      `SELECT * FROM Venta ${where} ORDER BY fecha ${orden}${limite}`,
      params,
    );
    return filas.map(mapVenta);
  },

  async findManyConCliente(
    filtro: FiltroVenta,
    opciones?: { orderBy?: "asc" | "desc"; take?: number },
  ): Promise<VentaConCliente[]> {
    const ventas = await venta.findMany(filtro, opciones);
    const clientesPorId = new Map<number, Cliente>();
    for (const v of ventas) {
      if (v.clienteId && !clientesPorId.has(v.clienteId)) {
        const c = await cliente.findUnique(v.clienteId);
        if (c) clientesPorId.set(v.clienteId, c);
      }
    }
    return ventas.map((v) => ({ ...v, cliente: v.clienteId ? (clientesPorId.get(v.clienteId) ?? null) : null }));
  },

  async findManyConPagos(
    filtro: FiltroVenta,
    opciones?: { orderBy?: "asc" | "desc" },
  ): Promise<VentaConPagos[]> {
    const ventas = await venta.findMany(filtro, opciones);
    const resultado: VentaConPagos[] = [];
    for (const v of ventas) {
      resultado.push({ ...v, pagosAplicados: await pagoVenta.findByVenta(v.id) });
    }
    return resultado;
  },

  async findUnique(id: number): Promise<Venta | null> {
    const ventas = await venta.findMany({ id });
    return ventas[0] ?? null;
  },

  async findDetalle(id: number): Promise<VentaDetalle | null> {
    const v = await venta.findUnique(id);
    if (!v) return null;
    const c = v.clienteId ? await cliente.findUnique(v.clienteId) : null;
    const filasItems = await consultar<{
      id: number; ventaId: number; productoId: number; cantidad: number; precioUnitario: number;
      descuento: number; subtotal: number; pNombre: string; pUnidad: string; pFactor: number; pCompra: number;
    }>(
      `SELECT vi.*, p.nombre as pNombre, p.unidadMedida as pUnidad, p.factorConversion as pFactor, p.precioCompra as pCompra
       FROM VentaItem vi JOIN Producto p ON p.id = vi.productoId
       WHERE vi.ventaId = ?`,
      [id],
    );
    const items: VentaItemConProducto[] = filasItems.map((f) => ({
      id: f.id, ventaId: f.ventaId, productoId: f.productoId, cantidad: f.cantidad,
      precioUnitario: f.precioUnitario, descuento: f.descuento, subtotal: f.subtotal,
      producto: { nombre: f.pNombre, unidadMedida: f.pUnidad, factorConversion: f.pFactor, precioCompra: f.pCompra },
    }));
    return { ...v, cliente: c, items };
  },

  async create(data: {
    clienteId: number | null; subtotal: number; descuento: number; total: number; formaPago: FormaPago;
  }): Promise<Venta> {
    const ahora = Date.now();
    const { lastId } = await ejecutar(
      `INSERT INTO Venta (clienteId, fecha, subtotal, descuento, total, formaPago, estado, createdAt, updatedAt)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [data.clienteId, ahora, data.subtotal, data.descuento, data.total, data.formaPago, "COMPLETADA", ahora, ahora],
    );
    const creada = await venta.findUnique(lastId);
    if (!creada) throw new Error("No se pudo leer la venta recién creada");
    return creada;
  },

  async update(id: number, data: { estado: "COMPLETADA" | "ANULADA"; motivoAnulacion?: string | null }): Promise<void> {
    await ejecutar("UPDATE Venta SET estado = ?, motivoAnulacion = ?, updatedAt = ? WHERE id = ?", [
      data.estado, data.motivoAnulacion ?? null, Date.now(), id,
    ]);
  },
};

const ventaItem = {
  async create(data: {
    ventaId: number; productoId: number; cantidad: number; precioUnitario: number; descuento: number; subtotal: number;
  }): Promise<void> {
    await ejecutar(
      "INSERT INTO VentaItem (ventaId, productoId, cantidad, precioUnitario, descuento, subtotal) VALUES (?,?,?,?,?,?)",
      [data.ventaId, data.productoId, data.cantidad, data.precioUnitario, data.descuento, data.subtotal],
    );
  },

  // Para reportes: items de ventas completadas en un rango de fechas, con datos del producto.
  async findConProductoEnRango(desde: Date, hasta: Date): Promise<VentaItemConProducto[]> {
    const filas = await consultar<{
      id: number; ventaId: number; productoId: number; cantidad: number; precioUnitario: number;
      descuento: number; subtotal: number; pNombre: string; pUnidad: string; pFactor: number; pCompra: number;
    }>(
      `SELECT vi.*, p.nombre as pNombre, p.unidadMedida as pUnidad, p.factorConversion as pFactor, p.precioCompra as pCompra
       FROM VentaItem vi
       JOIN Venta v ON v.id = vi.ventaId
       JOIN Producto p ON p.id = vi.productoId
       WHERE v.estado = 'COMPLETADA' AND v.fecha >= ? AND v.fecha <= ?`,
      [desde.getTime(), hasta.getTime()],
    );
    return filas.map((f) => ({
      id: f.id, ventaId: f.ventaId, productoId: f.productoId, cantidad: f.cantidad,
      precioUnitario: f.precioUnitario, descuento: f.descuento, subtotal: f.subtotal,
      producto: { nombre: f.pNombre, unidadMedida: f.pUnidad, factorConversion: f.pFactor, precioCompra: f.pCompra },
    }));
  },
};

// ---------------------------------------------------------------------------
// Pago / PagoVenta
// ---------------------------------------------------------------------------

const pago = {
  async create(data: { clienteId: number; monto: number; observacion?: string | null }): Promise<Pago> {
    const ahora = Date.now();
    const { lastId } = await ejecutar(
      "INSERT INTO Pago (clienteId, monto, fecha, observacion, createdAt) VALUES (?,?,?,?,?)",
      [data.clienteId, data.monto, ahora, data.observacion ?? null, ahora],
    );
    const filas = await consultar<FilaPago>("SELECT * FROM Pago WHERE id = ?", [lastId]);
    return mapPago(filas[0]);
  },

  async findByCliente(clienteId: number): Promise<Pago[]> {
    const filas = await consultar<FilaPago>("SELECT * FROM Pago WHERE clienteId = ? ORDER BY fecha DESC", [clienteId]);
    return filas.map(mapPago);
  },
};

const pagoVenta = {
  async create(data: { pagoId: number; ventaId: number; montoAplicado: number }): Promise<void> {
    await ejecutar("INSERT INTO PagoVenta (pagoId, ventaId, montoAplicado) VALUES (?,?,?)", [
      data.pagoId, data.ventaId, data.montoAplicado,
    ]);
  },

  async findByVenta(ventaId: number): Promise<PagoVenta[]> {
    const filas = await consultar<PagoVenta>("SELECT * FROM PagoVenta WHERE ventaId = ?", [ventaId]);
    return filas;
  },

  async sumAplicadoPorVenta(ventaId: number): Promise<number> {
    const filas = await consultar<{ total: number | null }>(
      "SELECT SUM(montoAplicado) as total FROM PagoVenta WHERE ventaId = ?",
      [ventaId],
    );
    return filas[0]?.total ?? 0;
  },
};

// ---------------------------------------------------------------------------
// Gasto
// ---------------------------------------------------------------------------

const gasto = {
  async create(data: { monto: number; descripcion: string }): Promise<Gasto> {
    const ahora = Date.now();
    const { lastId } = await ejecutar(
      "INSERT INTO Gasto (monto, descripcion, fecha, createdAt) VALUES (?,?,?,?)",
      [data.monto, data.descripcion, ahora, ahora],
    );
    const filas = await consultar<FilaGasto>("SELECT * FROM Gasto WHERE id = ?", [lastId]);
    return mapGasto(filas[0]);
  },

  async delete(id: number): Promise<void> {
    await ejecutar("DELETE FROM Gasto WHERE id = ?", [id]);
  },

  async findByRango(desde: Date, hasta: Date): Promise<Gasto[]> {
    const filas = await consultar<FilaGasto>(
      "SELECT * FROM Gasto WHERE fecha >= ? AND fecha <= ? ORDER BY fecha DESC",
      [desde.getTime(), hasta.getTime()],
    );
    return filas.map(mapGasto);
  },
};

// ---------------------------------------------------------------------------
// Configuracion
// ---------------------------------------------------------------------------

const configuracion = {
  async findFirst(): Promise<Configuracion | null> {
    const filas = await consultar<FilaConfiguracion>("SELECT * FROM Configuracion ORDER BY id ASC LIMIT 1");
    return filas[0] ? mapConfiguracion(filas[0]) : null;
  },

  async create(data: { nombreNegocio: string }): Promise<Configuracion> {
    const ahora = Date.now();
    const { lastId } = await ejecutar(
      "INSERT INTO Configuracion (nombreNegocio, moneda, simboloMoneda, diasAlertaVencimiento, updatedAt) VALUES (?,?,?,?,?)",
      [data.nombreNegocio, "BOB", "Bs", 30, ahora],
    );
    const filas = await consultar<FilaConfiguracion>("SELECT * FROM Configuracion WHERE id = ?", [lastId]);
    return mapConfiguracion(filas[0]);
  },

  async update(
    id: number,
    data: Partial<{
      nombreNegocio: string; moneda: string; simboloMoneda: string; pinHash: string | null; diasAlertaVencimiento: number;
    }>,
  ): Promise<void> {
    const campos: string[] = [];
    const params: unknown[] = [];
    if (data.nombreNegocio !== undefined) { campos.push("nombreNegocio = ?"); params.push(data.nombreNegocio); }
    if (data.moneda !== undefined) { campos.push("moneda = ?"); params.push(data.moneda); }
    if (data.simboloMoneda !== undefined) { campos.push("simboloMoneda = ?"); params.push(data.simboloMoneda); }
    if (data.pinHash !== undefined) { campos.push("pinHash = ?"); params.push(data.pinHash); }
    if (data.diasAlertaVencimiento !== undefined) { campos.push("diasAlertaVencimiento = ?"); params.push(data.diasAlertaVencimiento); }
    campos.push("updatedAt = ?");
    params.push(Date.now());
    params.push(id);
    await ejecutar(`UPDATE Configuracion SET ${campos.join(", ")} WHERE id = ?`, params);
  },
};

// ---------------------------------------------------------------------------
// AuditLog
// ---------------------------------------------------------------------------

const auditLog = {
  async create(data: { entidad: string; entidadId: number; accion: AccionAuditoria; detalle?: string | null }): Promise<void> {
    await ejecutar("INSERT INTO AuditLog (entidad, entidadId, accion, detalle, createdAt) VALUES (?,?,?,?,?)", [
      data.entidad, data.entidadId, data.accion, data.detalle ?? null, Date.now(),
    ]);
  },
};

// ---------------------------------------------------------------------------
// Cliente de base de datos + transacción
// ---------------------------------------------------------------------------

// Se declara la forma del cliente como un `type` (en vez de `typeof db`)
// porque un `type` puede referenciarse a sí mismo; un `const` no puede
// aparecer en la firma de sus propios métodos sin quedar en `any`.
export type Db = {
  producto: typeof producto;
  lote: typeof lote;
  movimientoInventario: typeof movimientoInventario;
  cliente: typeof cliente;
  venta: typeof venta;
  ventaItem: typeof ventaItem;
  pago: typeof pago;
  pagoVenta: typeof pagoVenta;
  gasto: typeof gasto;
  configuracion: typeof configuracion;
  auditLog: typeof auditLog;
  // Sistema de un solo usuario, una única conexión: no hace falta un cliente
  // de transacción separado, `tx` es el mismo `db`. BEGIN/COMMIT/ROLLBACK
  // envuelven las escrituras hechas por la función; si algo falla, se revierte todo.
  $transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
};

export const db: Db = {
  producto,
  lote,
  movimientoInventario,
  cliente,
  venta,
  ventaItem,
  pago,
  pagoVenta,
  gasto,
  configuracion,
  auditLog,

  async $transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
    const conexion = await obtenerConexion();
    // `transaction: false` es obligatorio acá: si no, el plugin envuelve esta
    // misma sentencia en su propia transacción implícita y SQLite rechaza el
    // BEGIN anidado ("cannot start a transaction within a transaction").
    await conexion.execute("BEGIN TRANSACTION;", false);
    try {
      const resultado = await fn(db);
      await conexion.execute("COMMIT TRANSACTION;", false);
      await persistirCambios();
      return resultado;
    } catch (error) {
      await conexion.execute("ROLLBACK TRANSACTION;", false);
      throw error;
    }
  },
};
