"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAcceso } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";
import { textoAFecha } from "@/lib/dates";
import { textoAUnidadesMinimas } from "@/lib/stock";
import { descontarFEFO } from "@/lib/lotes";
import {
  ajusteLoteSchema,
  entradaLoteSchema,
  salidaLoteSchema,
} from "@/validations/producto.schema";

export type EstadoLote = { error?: string; exito?: boolean };

export async function registrarEntradaLote(
  _estadoPrevio: EstadoLote,
  formData: FormData,
): Promise<EstadoLote> {
  await requireAcceso();

  const resultado = entradaLoteSchema.safeParse(Object.fromEntries(formData));
  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { productoId, cantidadTexto, fechaVencimientoTexto, motivo } = resultado.data;

  const producto = await db.producto.findUnique({ where: { id: productoId } });
  if (!producto || !producto.activo) {
    return { error: "El producto no existe o está inactivo" };
  }
  if (!producto.perecedero) {
    return { error: "Este producto no maneja lotes" };
  }

  let cantidad: number;
  let fechaVencimiento: Date;
  try {
    cantidad = textoAUnidadesMinimas(cantidadTexto, producto.factorConversion);
    fechaVencimiento = textoAFecha(fechaVencimientoTexto);
  } catch (error) {
    return { error: (error as Error).message };
  }
  if (cantidad <= 0) {
    return { error: "La cantidad debe ser mayor a cero" };
  }

  const stockAnterior = producto.stockActual;
  const stockPosterior = stockAnterior + cantidad;

  try {
    await db.$transaction(async (tx) => {
      const lote = await tx.lote.create({
        data: { productoId, cantidad, fechaVencimiento },
      });

      await tx.movimientoInventario.create({
        data: {
          productoId,
          loteId: lote.id,
          tipo: "ENTRADA",
          cantidad,
          stockAnterior,
          stockPosterior,
          motivo,
        },
      });

      await tx.producto.update({ where: { id: productoId }, data: { stockActual: stockPosterior } });

      await registrarAuditoria(tx, {
        entidad: "Lote",
        entidadId: lote.id,
        accion: "CREAR",
        detalle: { productoId, cantidad, fechaVencimiento, motivo },
      });
    });
  } catch {
    return { error: "No se pudo registrar el lote. Intentá de nuevo." };
  }

  revalidatePath(`/productos/${productoId}`);
  revalidatePath("/productos");
  return { exito: true };
}

// Salida o merma de un perecedero: se descuenta del lote que vence antes
// (FEFO), sin que el usuario tenga que elegir cuál.
export async function registrarSalidaLote(
  _estadoPrevio: EstadoLote,
  formData: FormData,
): Promise<EstadoLote> {
  await requireAcceso();

  const resultado = salidaLoteSchema.safeParse(Object.fromEntries(formData));
  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { productoId, cantidadTexto, motivo } = resultado.data;

  const producto = await db.producto.findUnique({ where: { id: productoId } });
  if (!producto || !producto.activo) {
    return { error: "El producto no existe o está inactivo" };
  }
  if (!producto.perecedero) {
    return { error: "Este producto no maneja lotes" };
  }

  let cantidad: number;
  try {
    cantidad = textoAUnidadesMinimas(cantidadTexto, producto.factorConversion);
  } catch (error) {
    return { error: (error as Error).message };
  }
  if (cantidad <= 0) {
    return { error: "La cantidad debe ser mayor a cero" };
  }

  const stockAnterior = producto.stockActual;

  try {
    await db.$transaction(async (tx) => {
      const afectados = await descontarFEFO(tx, productoId, cantidad);

      for (const lote of afectados) {
        await tx.movimientoInventario.create({
          data: {
            productoId,
            loteId: lote.loteId,
            tipo: "SALIDA",
            cantidad: lote.cantidad,
            stockAnterior,
            stockPosterior: stockAnterior - cantidad,
            motivo,
          },
        });
      }

      await tx.producto.update({
        where: { id: productoId },
        data: { stockActual: stockAnterior - cantidad },
      });

      await registrarAuditoria(tx, {
        entidad: "Producto",
        entidadId: productoId,
        accion: "AJUSTAR",
        detalle: { tipo: "SALIDA", cantidad, motivo },
      });
    });
  } catch (error) {
    return { error: (error as Error).message };
  }

  revalidatePath(`/productos/${productoId}`);
  revalidatePath("/productos");
  return { exito: true };
}

// Corrección puntual de UN lote (conteo real de ese lote), elegido por el
// usuario en la lista de lotes del producto.
export async function ajustarLote(
  _estadoPrevio: EstadoLote,
  formData: FormData,
): Promise<EstadoLote> {
  await requireAcceso();

  const resultado = ajusteLoteSchema.safeParse(Object.fromEntries(formData));
  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { loteId, cantidadRealTexto, motivo } = resultado.data;

  const lote = await db.lote.findUnique({ where: { id: loteId }, include: { producto: true } });
  if (!lote) {
    return { error: "El lote no existe" };
  }

  let cantidadReal: number;
  try {
    cantidadReal = textoAUnidadesMinimas(cantidadRealTexto, lote.producto.factorConversion);
  } catch (error) {
    return { error: (error as Error).message };
  }
  if (cantidadReal < 0) {
    return { error: "La cantidad no puede ser negativa" };
  }
  if (cantidadReal === lote.cantidad) {
    return { error: "La cantidad ingresada es igual a la actual del lote, no hay nada que ajustar" };
  }

  const diferencia = cantidadReal - lote.cantidad;
  const stockAnterior = lote.producto.stockActual;
  const stockPosterior = stockAnterior + diferencia;

  try {
    await db.$transaction(async (tx) => {
      await tx.lote.update({ where: { id: loteId }, data: { cantidad: cantidadReal } });

      await tx.movimientoInventario.create({
        data: {
          productoId: lote.productoId,
          loteId,
          tipo: "AJUSTE",
          cantidad: Math.abs(diferencia),
          stockAnterior,
          stockPosterior,
          motivo,
        },
      });

      await tx.producto.update({ where: { id: lote.productoId }, data: { stockActual: stockPosterior } });

      await registrarAuditoria(tx, {
        entidad: "Lote",
        entidadId: loteId,
        accion: "AJUSTAR",
        detalle: { cantidadAnterior: lote.cantidad, cantidadReal, motivo },
      });
    });
  } catch {
    return { error: "No se pudo ajustar el lote. Intentá de nuevo." };
  }

  revalidatePath(`/productos/${lote.productoId}`);
  revalidatePath("/productos");
  return { exito: true };
}
