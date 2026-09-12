import { db } from "@/lib/db/client";
import { requireAcceso } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";
import { textoACentavos } from "@/lib/money";
import { textoAUnidadesMinimas } from "@/lib/stock";
import { fechaATexto } from "@/lib/dates";
import { calcularSaldoPendiente } from "@/lib/creditos";
import { calcularStockVendible, descontarFEFO, obtenerLotesVendibles } from "@/lib/lotes";
import {
  anularVentaSchema,
  crearVentaSchema,
  itemsVentaArraySchema,
} from "@/validations/venta.schema";

export type EstadoVentaForm = { error?: string; requiereConfirmacion?: boolean; id?: number };
export type EstadoAnulacion = { error?: string; exito?: boolean };

export type ProductoBusquedaVenta = {
  id: number;
  nombre: string;
  unidadMedida: string;
  factorConversion: number;
  precioVenta: number;
  stockActual: number;
  perecedero: boolean;
  // dd/mm/aaaa del lote que se despacharía primero (FEFO), si es perecedero.
  proximoVencimiento: string | null;
};

// Búsqueda simple en memoria, igual que el listado de productos: los
// negocios chicos manejan pocos cientos de productos como mucho.
export async function buscarProductosVenta(query: string): Promise<ProductoBusquedaVenta[]> {
  await requireAcceso();

  const q = query.trim().toLowerCase();
  if (!q) return [];

  const productos = await db.producto.findMany({ activo: true });

  const coincidencias = productos
    .filter((p) => p.nombre.toLowerCase().includes(q))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
    .slice(0, 15);

  const resultados: ProductoBusquedaVenta[] = [];
  for (const producto of coincidencias) {
    let stockVenta = producto.stockActual;
    let proximoVencimiento: string | null = null;

    if (producto.perecedero) {
      const lotes = await obtenerLotesVendibles(db, producto.id);
      stockVenta = lotes.reduce((acc, lote) => acc + lote.cantidad, 0);
      proximoVencimiento = lotes[0] ? fechaATexto(lotes[0].fechaVencimiento) : null;
    }

    resultados.push({
      id: producto.id,
      nombre: producto.nombre,
      unidadMedida: producto.unidadMedida,
      factorConversion: producto.factorConversion,
      precioVenta: producto.precioVenta,
      stockActual: stockVenta,
      perecedero: producto.perecedero,
      proximoVencimiento,
    });
  }
  return resultados;
}

// Alta de producto al vuelo desde la pantalla de venta: solo nombre y precio
// de venta. El resto queda con valores por defecto (el dueño lo completa
// después desde la ficha del producto si quiere). Para que la venta se pueda
// completar ahí mismo, se le da 1 unidad de stock inicial (un movimiento de
// ENTRADA real, no una edición directa del stock).
export async function crearProductoRapido(
  nombre: string,
  precioVentaTexto: string,
): Promise<{ error?: string; producto?: ProductoBusquedaVenta }> {
  await requireAcceso();

  const nombreLimpio = nombre.trim();
  if (!nombreLimpio) {
    return { error: "Ingresá el nombre del producto" };
  }

  let precioVenta: number;
  try {
    precioVenta = textoACentavos(precioVentaTexto);
  } catch (error) {
    return { error: (error as Error).message };
  }
  if (precioVenta <= 0) {
    return { error: "Ingresá un precio de venta válido" };
  }

  try {
    const producto = await db.$transaction(async (tx) => {
      const nuevo = await tx.producto.create({
        nombre: nombreLimpio,
        unidadMedida: "unidad",
        factorConversion: 1,
        precioCompra: 0,
        precioVenta,
        stockActual: 1,
        stockMinimo: 0,
      });

      await tx.movimientoInventario.create({
        productoId: nuevo.id,
        tipo: "ENTRADA",
        cantidad: 1,
        stockAnterior: 0,
        stockPosterior: 1,
        motivo: "Alta rápida desde la venta",
      });

      await registrarAuditoria(tx, {
        entidad: "Producto",
        entidadId: nuevo.id,
        accion: "CREAR",
        detalle: { nombre: nombreLimpio, origen: "venta_rapida" },
      });

      return nuevo;
    });

    return {
      producto: {
        id: producto.id,
        nombre: producto.nombre,
        unidadMedida: producto.unidadMedida,
        factorConversion: producto.factorConversion,
        precioVenta: producto.precioVenta,
        stockActual: producto.stockActual,
        perecedero: false,
        proximoVencimiento: null,
      },
    };
  } catch {
    return { error: "No se pudo crear el producto. Intentá de nuevo." };
  }
}

export async function crearVenta(
  _estadoPrevio: EstadoVentaForm,
  formData: FormData,
): Promise<EstadoVentaForm> {
  await requireAcceso();

  const resultado = crearVentaSchema.safeParse(Object.fromEntries(formData));
  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { clienteId, formaPago, descuentoTotalTexto, itemsJson, confirmarExcesoCredito } = resultado.data;

  let itemsCrudos: unknown;
  try {
    itemsCrudos = JSON.parse(itemsJson);
  } catch {
    return { error: "El carrito no es válido" };
  }
  const itemsResultado = itemsVentaArraySchema.safeParse(itemsCrudos);
  if (!itemsResultado.success) {
    return { error: itemsResultado.error.issues[0]?.message ?? "Agregá al menos un producto" };
  }
  const items = itemsResultado.data;

  const hayDescuentoPorItem = items.some(
    (item) => item.descuentoTexto && item.descuentoTexto.trim() !== "" && item.descuentoTexto.trim() !== "0",
  );
  const hayDescuentoTotal =
    !!descuentoTotalTexto && descuentoTotalTexto.trim() !== "" && descuentoTotalTexto.trim() !== "0";
  if (hayDescuentoPorItem && hayDescuentoTotal) {
    return { error: "Usá descuento por producto o descuento al total, no los dos a la vez" };
  }

  if (formaPago === "CREDITO" && !clienteId) {
    return { error: "Elegí un cliente para registrar una venta a crédito" };
  }

  let descuentoTotalCentavos = 0;
  try {
    descuentoTotalCentavos = hayDescuentoTotal ? textoACentavos(descuentoTotalTexto!) : 0;
  } catch (error) {
    return { error: (error as Error).message };
  }
  if (descuentoTotalCentavos < 0) {
    return { error: "El descuento no puede ser negativo" };
  }

  const productos = await db.producto.findMany({ idIn: items.map((item) => item.productoId) });
  const productosPorId = new Map(productos.map((p) => [p.id, p]));

  type ItemProcesado = {
    productoId: number;
    perecedero: boolean;
    cantidad: number;
    precioUnitario: number;
    descuento: number;
    subtotal: number;
    stockAnterior: number;
    stockPosterior: number;
  };
  const itemsProcesados: ItemProcesado[] = [];
  let subtotalVenta = 0;

  for (const item of items) {
    const producto = productosPorId.get(item.productoId);
    if (!producto || !producto.activo) {
      return { error: "Uno de los productos del carrito ya no está disponible" };
    }

    let cantidad: number;
    try {
      cantidad = textoAUnidadesMinimas(item.cantidadTexto, producto.factorConversion);
    } catch (error) {
      return { error: `${producto.nombre}: ${(error as Error).message}` };
    }
    if (cantidad <= 0) {
      return { error: `${producto.nombre}: la cantidad debe ser mayor a cero` };
    }

    if (producto.perecedero) {
      const stockVendible = await calcularStockVendible(db, producto.id);
      if (cantidad > stockVendible) {
        return {
          error:
            stockVendible < producto.stockActual
              ? `Stock insuficiente de "${producto.nombre}" (parte de su stock está vencido y no se puede vender)`
              : `Stock insuficiente de "${producto.nombre}"`,
        };
      }
    } else if (cantidad > producto.stockActual) {
      return { error: `Stock insuficiente de "${producto.nombre}"` };
    }

    let descuentoItem = 0;
    if (item.descuentoTexto && item.descuentoTexto.trim() !== "") {
      try {
        descuentoItem = textoACentavos(item.descuentoTexto);
      } catch (error) {
        return { error: `${producto.nombre}: ${(error as Error).message}` };
      }
    }
    if (descuentoItem < 0) {
      return { error: `${producto.nombre}: el descuento no puede ser negativo` };
    }

    const bruto = Math.round((producto.precioVenta * cantidad) / producto.factorConversion);
    if (descuentoItem > bruto) {
      return { error: `${producto.nombre}: el descuento no puede superar el importe del producto` };
    }

    subtotalVenta += bruto;
    itemsProcesados.push({
      productoId: producto.id,
      perecedero: producto.perecedero,
      cantidad,
      precioUnitario: producto.precioVenta,
      descuento: descuentoItem,
      subtotal: bruto - descuentoItem,
      stockAnterior: producto.stockActual,
      stockPosterior: producto.stockActual - cantidad,
    });
  }

  if (descuentoTotalCentavos > subtotalVenta) {
    return { error: "El descuento no puede superar el subtotal de la venta" };
  }

  const descuentoFinal = hayDescuentoTotal
    ? descuentoTotalCentavos
    : itemsProcesados.reduce((acc, item) => acc + item.descuento, 0);
  const total = subtotalVenta - descuentoFinal;

  if (formaPago === "CREDITO" && clienteId) {
    const cliente = await db.cliente.findUnique(clienteId);
    if (!cliente || !cliente.activo) {
      return { error: "El cliente elegido no existe o está inactivo" };
    }
    const saldoActual = await calcularSaldoPendiente(db, clienteId);
    if (saldoActual + total > cliente.limiteCredito && confirmarExcesoCredito !== "1") {
      return {
        error: `${cliente.nombre} va a superar su límite de crédito con esta venta. Confirmá si querés venderle igual.`,
        requiereConfirmacion: true,
      };
    }
  }

  let ventaId: number;
  try {
    ventaId = await db.$transaction(async (tx) => {
      const venta = await tx.venta.create({
        clienteId: clienteId ?? null,
        subtotal: subtotalVenta,
        descuento: descuentoFinal,
        total,
        formaPago,
      });

      for (const item of itemsProcesados) {
        await tx.ventaItem.create({
          ventaId: venta.id,
          productoId: item.productoId,
          cantidad: item.cantidad,
          precioUnitario: item.precioUnitario,
          descuento: item.descuento,
          subtotal: item.subtotal,
        });

        if (item.perecedero) {
          const afectados = await descontarFEFO(tx, item.productoId, item.cantidad);
          for (const l of afectados) {
            await tx.movimientoInventario.create({
              productoId: item.productoId,
              loteId: l.loteId,
              tipo: "SALIDA",
              cantidad: l.cantidad,
              stockAnterior: item.stockAnterior,
              stockPosterior: item.stockPosterior,
              motivo: `Venta #${venta.id}`,
              ventaId: venta.id,
            });
          }
        } else {
          await tx.movimientoInventario.create({
            productoId: item.productoId,
            tipo: "SALIDA",
            cantidad: item.cantidad,
            stockAnterior: item.stockAnterior,
            stockPosterior: item.stockPosterior,
            motivo: `Venta #${venta.id}`,
            ventaId: venta.id,
          });
        }

        await tx.producto.update(item.productoId, { stockActual: item.stockPosterior });
      }

      await registrarAuditoria(tx, {
        entidad: "Venta",
        entidadId: venta.id,
        accion: "CREAR",
        detalle: { total, formaPago, clienteId: clienteId ?? null, items: itemsProcesados.length },
      });

      return venta.id;
    });
  } catch {
    return { error: "No se pudo registrar la venta. Intentá de nuevo." };
  }

  return { id: ventaId };
}

export async function anularVenta(
  _estadoPrevio: EstadoAnulacion,
  formData: FormData,
): Promise<EstadoAnulacion> {
  await requireAcceso();

  const resultado = anularVentaSchema.safeParse(Object.fromEntries(formData));
  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { ventaId, motivo } = resultado.data;

  const venta = await db.venta.findDetalle(ventaId);
  if (!venta) return { error: "La venta no existe" };
  if (venta.estado === "ANULADA") return { error: "La venta ya está anulada" };

  if (venta.formaPago === "CREDITO") {
    const totalAplicado = await db.pagoVenta.sumAplicadoPorVenta(venta.id);
    if (totalAplicado > 0) {
      return { error: "No se puede anular: esta venta ya tiene pagos aplicados." };
    }
  }

  try {
    await db.$transaction(async (tx) => {
      for (const item of venta.items) {
        const producto = await tx.producto.findUnique(item.productoId);
        if (!producto) continue;

        const stockAnterior = producto.stockActual;
        const stockPosterior = stockAnterior + item.cantidad;

        if (producto.perecedero) {
          // Devolver cada cantidad al mismo lote del que había salido.
          const salidas = await tx.movimientoInventario.findSalidasDeVenta(venta.id, item.productoId);
          for (const salida of salidas) {
            if (!salida.loteId) continue;
            const l = await tx.lote.findUnique(salida.loteId);
            if (!l) continue;
            await tx.lote.update(l.id, { cantidad: l.cantidad + salida.cantidad });
            await tx.movimientoInventario.create({
              productoId: item.productoId,
              loteId: l.id,
              tipo: "ENTRADA",
              cantidad: salida.cantidad,
              stockAnterior,
              stockPosterior,
              motivo: `Anulación de venta #${venta.id}`,
              ventaId: venta.id,
            });
          }
        } else {
          await tx.movimientoInventario.create({
            productoId: item.productoId,
            tipo: "ENTRADA",
            cantidad: item.cantidad,
            stockAnterior,
            stockPosterior,
            motivo: `Anulación de venta #${venta.id}`,
            ventaId: venta.id,
          });
        }

        await tx.producto.update(item.productoId, { stockActual: stockPosterior });
      }

      await tx.venta.update(venta.id, { estado: "ANULADA", motivoAnulacion: motivo });

      await registrarAuditoria(tx, {
        entidad: "Venta",
        entidadId: venta.id,
        accion: "ANULAR",
        detalle: { motivo },
      });
    });
  } catch {
    return { error: "No se pudo anular la venta. Intentá de nuevo." };
  }

  return { exito: true };
}
