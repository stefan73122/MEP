"use server";

import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAcceso } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";
import { textoACentavos } from "@/lib/money";
import { textoAUnidadesMinimas } from "@/lib/stock";
import { textoAFecha } from "@/lib/dates";
import { actualizarProductoSchema, crearProductoSchema } from "@/validations/producto.schema";
import type { TipoVenta } from "@/lib/constants";

export type EstadoFormularioProducto = { error?: string };

function derivarUnidad(tipoVenta: TipoVenta, unidadPersonalizada: string | undefined) {
  if (tipoVenta === "PESO") return { unidadMedida: "kg", factorConversion: 1000 };
  if (tipoVenta === "VOLUMEN") return { unidadMedida: "litro", factorConversion: 1000 };
  return { unidadMedida: unidadPersonalizada?.trim() || "unidad", factorConversion: 1 };
}

export async function crearProducto(
  _estadoPrevio: EstadoFormularioProducto,
  formData: FormData,
): Promise<EstadoFormularioProducto> {
  await requireAcceso();

  const resultado = crearProductoSchema.safeParse(Object.fromEntries(formData));
  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const datos = resultado.data;

  const { unidadMedida, factorConversion } = derivarUnidad(
    datos.tipoVenta,
    datos.unidadMedidaPersonalizada,
  );

  let precioCompra: number;
  let precioVenta: number;
  let stockMinimo: number;
  let stockInicial: number;
  try {
    precioCompra = textoACentavos(datos.precioCompraTexto);
    precioVenta = textoACentavos(datos.precioVentaTexto);
    stockMinimo = textoAUnidadesMinimas(datos.stockMinimoTexto, factorConversion);
    stockInicial = textoAUnidadesMinimas(datos.stockInicialTexto, factorConversion);
  } catch (error) {
    return { error: (error as Error).message };
  }

  if (precioCompra < 0 || precioVenta < 0) {
    return { error: "Los precios no pueden ser negativos" };
  }
  if (stockMinimo < 0) {
    return { error: "El stock mínimo no puede ser negativo" };
  }
  if (stockInicial < 0) {
    return { error: "El stock inicial no puede ser negativo" };
  }

  let fechaVencimientoInicial: Date | undefined;
  if (datos.perecedero && stockInicial > 0) {
    if (!datos.fechaVencimientoInicialTexto) {
      return { error: "Ingresá la fecha de vencimiento del primer lote" };
    }
    try {
      fechaVencimientoInicial = textoAFecha(datos.fechaVencimientoInicialTexto);
    } catch (error) {
      return { error: (error as Error).message };
    }
  }

  try {
    await db.$transaction(async (tx) => {
      const producto = await tx.producto.create({
        data: {
          sku: datos.sku,
          nombre: datos.nombre,
          categoria: datos.categoria ?? null,
          unidadMedida,
          factorConversion,
          precioCompra,
          precioVenta,
          perecedero: datos.perecedero,
          stockActual: stockInicial,
          stockMinimo,
        },
      });

      if (stockInicial > 0) {
        let loteId: number | undefined;
        if (datos.perecedero && fechaVencimientoInicial) {
          const lote = await tx.lote.create({
            data: { productoId: producto.id, cantidad: stockInicial, fechaVencimiento: fechaVencimientoInicial },
          });
          loteId = lote.id;
        }

        await tx.movimientoInventario.create({
          data: {
            productoId: producto.id,
            loteId,
            tipo: "ENTRADA",
            cantidad: stockInicial,
            stockAnterior: 0,
            stockPosterior: stockInicial,
            motivo: "Stock inicial",
          },
        });
      }

      await registrarAuditoria(tx, {
        entidad: "Producto",
        entidadId: producto.id,
        accion: "CREAR",
        detalle: { sku: datos.sku, nombre: datos.nombre },
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: `Ya existe un producto con el código "${datos.sku}"` };
    }
    return { error: "No se pudo guardar el producto. Intentá de nuevo." };
  }

  revalidatePath("/productos");
  redirect("/productos");
}

export async function actualizarProducto(
  _estadoPrevio: EstadoFormularioProducto,
  formData: FormData,
): Promise<EstadoFormularioProducto> {
  await requireAcceso();

  const resultado = actualizarProductoSchema.safeParse(Object.fromEntries(formData));
  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const datos = resultado.data;

  const productoActual = await db.producto.findUnique({ where: { id: datos.id } });
  if (!productoActual) {
    return { error: "El producto no existe" };
  }

  let precioCompra: number;
  let precioVenta: number;
  let stockMinimo: number;
  try {
    precioCompra = textoACentavos(datos.precioCompraTexto);
    precioVenta = textoACentavos(datos.precioVentaTexto);
    stockMinimo = textoAUnidadesMinimas(datos.stockMinimoTexto, productoActual.factorConversion);
  } catch (error) {
    return { error: (error as Error).message };
  }

  if (precioCompra < 0 || precioVenta < 0) {
    return { error: "Los precios no pueden ser negativos" };
  }
  if (stockMinimo < 0) {
    return { error: "El stock mínimo no puede ser negativo" };
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.producto.update({
        where: { id: datos.id },
        data: {
          nombre: datos.nombre,
          categoria: datos.categoria ?? null,
          precioCompra,
          precioVenta,
          stockMinimo,
        },
      });

      await registrarAuditoria(tx, {
        entidad: "Producto",
        entidadId: datos.id,
        accion: "ACTUALIZAR",
        detalle: { nombre: datos.nombre, precioCompra, precioVenta, stockMinimo },
      });
    });
  } catch {
    return { error: "No se pudo actualizar el producto. Intentá de nuevo." };
  }

  revalidatePath("/productos");
  revalidatePath(`/productos/${datos.id}`);
  redirect(`/productos/${datos.id}`);
}

export async function cambiarEstadoProducto(productoId: number, activo: boolean): Promise<void> {
  await requireAcceso();

  await db.$transaction(async (tx) => {
    await tx.producto.update({ where: { id: productoId }, data: { activo } });
    await registrarAuditoria(tx, {
      entidad: "Producto",
      entidadId: productoId,
      accion: "ACTUALIZAR",
      detalle: { activo },
    });
  });

  revalidatePath("/productos");
  revalidatePath(`/productos/${productoId}`);
}
