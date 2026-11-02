import type { Db } from "./db/client";
import { fechaATexto, finDelDia, inicioDelDia, textoAFecha } from "./dates";

function primerDiaDelMesActual(): Date {
  const hoy = new Date();
  return new Date(hoy.getFullYear(), hoy.getMonth(), 1);
}

// Filtro de fechas compartido por la página de reportes y sus exportaciones:
// por defecto, el mes en curso hasta hoy.
export function resolverRangoReporte(
  desdeTexto: string | null | undefined,
  hastaTexto: string | null | undefined,
): { desde: Date; hasta: Date } {
  const parsear = (texto: string | null | undefined, porDefecto: Date): Date => {
    if (!texto) return porDefecto;
    try {
      return textoAFecha(texto);
    } catch {
      return porDefecto;
    }
  };

  const desde = parsear(desdeTexto, primerDiaDelMesActual());
  const hasta = parsear(hastaTexto, new Date());
  return { desde: inicioDelDia(desde), hasta: finDelDia(hasta) };
}

const ETIQUETAS_MES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function claveDia(fecha: Date): string {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

function claveMes(fecha: Date): string {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  return `${anio}-${mes}`;
}

export function obtenerVentasCompletadas(db: Db, desde: Date, hasta: Date) {
  return db.venta.findMany({ estado: "COMPLETADA", fechaGte: desde, fechaLte: hasta }, { orderBy: "asc" });
}

export type GrupoVentas = { claveOrden: string; etiqueta: string; cantidadVentas: number; total: number };

export function agruparVentasPorDia(ventas: { fecha: Date; total: number }[]): GrupoVentas[] {
  const mapa = new Map<string, GrupoVentas>();
  for (const venta of ventas) {
    const clave = claveDia(venta.fecha);
    const actual = mapa.get(clave) ?? {
      claveOrden: clave,
      etiqueta: fechaATexto(venta.fecha),
      cantidadVentas: 0,
      total: 0,
    };
    actual.cantidadVentas += 1;
    actual.total += venta.total;
    mapa.set(clave, actual);
  }
  return Array.from(mapa.values()).sort((a, b) => b.claveOrden.localeCompare(a.claveOrden));
}

export function agruparVentasPorMes(ventas: { fecha: Date; total: number }[]): GrupoVentas[] {
  const mapa = new Map<string, GrupoVentas>();
  for (const venta of ventas) {
    const clave = claveMes(venta.fecha);
    const actual = mapa.get(clave) ?? {
      claveOrden: clave,
      etiqueta: `${ETIQUETAS_MES[venta.fecha.getMonth()]} ${venta.fecha.getFullYear()}`,
      cantidadVentas: 0,
      total: 0,
    };
    actual.cantidadVentas += 1;
    actual.total += venta.total;
    mapa.set(clave, actual);
  }
  return Array.from(mapa.values()).sort((a, b) => b.claveOrden.localeCompare(a.claveOrden));
}

export type ProductoMasVendido = {
  productoId: number;
  nombre: string;
  unidadMedida: string;
  factorConversion: number;
  cantidadVendida: number;
  montoVendido: number;
};

// Ranking por monto vendido (comparable entre productos con distinta unidad
// de medida, a diferencia de sumar cantidades de kg con cantidades de unidades).
export async function obtenerProductosMasVendidos(
  db: Db,
  desde: Date,
  hasta: Date,
  limite = 10,
): Promise<ProductoMasVendido[]> {
  const items = await db.ventaItem.findConProductoEnRango(desde, hasta);

  const mapa = new Map<number, ProductoMasVendido>();
  for (const item of items) {
    const actual = mapa.get(item.productoId) ?? {
      productoId: item.productoId,
      nombre: item.producto.nombre,
      unidadMedida: item.producto.unidadMedida,
      factorConversion: item.producto.factorConversion,
      cantidadVendida: 0,
      montoVendido: 0,
    };
    actual.cantidadVendida += item.cantidad;
    actual.montoVendido += item.subtotal;
    mapa.set(item.productoId, actual);
  }

  return Array.from(mapa.values())
    .sort((a, b) => b.montoVendido - a.montoVendido)
    .slice(0, limite);
}

// `ingresos` y `costoEstimado` son de productos. Los servicios no tienen
// costo cargado: lo cobrado por ellos (`ingresosServicios`) suma entero.
export type GananciaEstimada = {
  ingresos: number;
  costoEstimado: number;
  ingresosServicios: number;
  ganancia: number;
};

// "Estimada" porque se calcula con el precio de compra ACTUAL del producto,
// no con el que tenía en el momento de cada venta (no se guarda historial de costos).
export async function calcularGananciaEstimada(db: Db, desde: Date, hasta: Date): Promise<GananciaEstimada> {
  const [items, servicios] = await Promise.all([
    db.ventaItem.findConProductoEnRango(desde, hasta),
    db.ventaServicio.rankingEnRango(desde, hasta, -1),
  ]);

  let ingresos = 0;
  let costoEstimado = 0;
  for (const item of items) {
    ingresos += item.subtotal;
    costoEstimado += Math.round((item.producto.precioCompra * item.cantidad) / item.producto.factorConversion);
  }
  const ingresosServicios = servicios.reduce((acc, s) => acc + s.monto, 0);

  return { ingresos, costoEstimado, ingresosServicios, ganancia: ingresos - costoEstimado + ingresosServicios };
}

export function obtenerGastos(db: Db, desde: Date, hasta: Date) {
  return db.gasto.findByRango(desde, hasta);
}

export async function calcularTotalGastos(db: Db, desde: Date, hasta: Date): Promise<number> {
  const gastos = await obtenerGastos(db, desde, hasta);
  return gastos.reduce((acc, gasto) => acc + gasto.monto, 0);
}

export type ResumenHoy = {
  cantidadVentas: number;
  total: number;
  efectivo: number;
  transferenciaQr: number;
  credito: number;
};

// Resumen del día en curso: siempre visible en la pantalla de reportes, sin
// necesidad de elegir un rango de fechas (reemplaza el cierre de caja).
export async function obtenerResumenHoy(db: Db): Promise<ResumenHoy> {
  const ahora = new Date();
  const ventas = await obtenerVentasCompletadas(db, inicioDelDia(ahora), finDelDia(ahora));

  const resumen: ResumenHoy = { cantidadVentas: 0, total: 0, efectivo: 0, transferenciaQr: 0, credito: 0 };
  for (const venta of ventas) {
    resumen.cantidadVentas += 1;
    resumen.total += venta.total;
    if (venta.formaPago === "EFECTIVO") resumen.efectivo += venta.total;
    else if (venta.formaPago === "TRANSFERENCIA_QR") resumen.transferenciaQr += venta.total;
    else if (venta.formaPago === "CREDITO") resumen.credito += venta.total;
  }
  return resumen;
}

// ---------------------------------------------------------------------------
// Servicios vs. productos
// ---------------------------------------------------------------------------

export type IngresoPorTipo = { fecha: Date; total: number; servicios: number; productos: number };

// Cuánto de cada venta/atención fue por servicios y cuánto por productos. El
// descuento general (al total) se reparte en proporción a lo que pesa cada
// parte; el redondeo se lo lleva productos, así las dos partes suman
// exactamente el total cobrado.
export async function obtenerIngresosPorTipo(db: Db, desde: Date, hasta: Date): Promise<IngresoPorTipo[]> {
  const filas = await db.venta.ingresosPorTipoEnRango(desde, hasta);
  return filas.map((fila) => {
    const bruto = fila.productos + fila.servicios;
    if (bruto <= 0) return { fecha: fila.fecha, total: fila.total, servicios: 0, productos: fila.total };
    const descuentoGeneral = Math.max(0, bruto - fila.total);
    const servicios = fila.servicios - Math.round((descuentoGeneral * fila.servicios) / bruto);
    return { fecha: fila.fecha, total: fila.total, servicios, productos: fila.total - servicios };
  });
}

export type DesgloseGrupo = { claveOrden: string; servicios: number; productos: number };

// Mismas claves que agruparVentasPorDia / agruparVentasPorMes, para poder
// mostrar el desglose al lado de cada grupo.
export function desglosarPorGrupo(ingresos: IngresoPorTipo[], porMes: boolean): Map<string, DesgloseGrupo> {
  const mapa = new Map<string, DesgloseGrupo>();
  for (const ingreso of ingresos) {
    const clave = porMes ? claveMes(ingreso.fecha) : claveDia(ingreso.fecha);
    const actual = mapa.get(clave) ?? { claveOrden: clave, servicios: 0, productos: 0 };
    actual.servicios += ingreso.servicios;
    actual.productos += ingreso.productos;
    mapa.set(clave, actual);
  }
  return mapa;
}

export type ServicioMasRealizado = { servicioId: number; nombre: string; cantidad: number; monto: number };

// Ranking por cantidad de veces realizado (a diferencia de los productos,
// que se ordenan por monto: acá todos se cuentan en la misma unidad).
export function obtenerServiciosMasRealizados(
  db: Db,
  desde: Date,
  hasta: Date,
  limite = 10,
): Promise<ServicioMasRealizado[]> {
  return db.ventaServicio.rankingEnRango(desde, hasta, limite);
}
