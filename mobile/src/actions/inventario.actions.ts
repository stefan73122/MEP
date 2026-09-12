import { db } from "@/lib/db/client";
import { requireAcceso } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";
import { unidadesMinimasATexto, textoAUnidadesMinimas } from "@/lib/stock";
import { movimientoSchema } from "@/validations/producto.schema";

export type EstadoMovimiento = { error?: string; exito?: boolean };

export async function registrarMovimiento(
  _estadoPrevio: EstadoMovimiento,
  formData: FormData,
): Promise<EstadoMovimiento> {
  await requireAcceso();

  const resultado = movimientoSchema.safeParse(Object.fromEntries(formData));
  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { productoId, tipo, cantidadTexto, motivo } = resultado.data;

  const producto = await db.producto.findUnique(productoId);
  if (!producto || !producto.activo) {
    return { error: "El producto no existe o está inactivo" };
  }
  if (producto.perecedero) {
    return { error: "Este producto maneja lotes: registrá el movimiento desde la sección de lotes" };
  }

  let cantidadIngresada: number;
  try {
    cantidadIngresada = textoAUnidadesMinimas(cantidadTexto, producto.factorConversion);
  } catch (error) {
    return { error: (error as Error).message };
  }

  const stockAnterior = producto.stockActual;
  let stockPosterior: number;
  let cantidadRegistrada: number;

  if (tipo === "ENTRADA") {
    if (cantidadIngresada <= 0) return { error: "La cantidad debe ser mayor a cero" };
    stockPosterior = stockAnterior + cantidadIngresada;
    cantidadRegistrada = cantidadIngresada;
  } else if (tipo === "SALIDA") {
    if (cantidadIngresada <= 0) return { error: "La cantidad debe ser mayor a cero" };
    if (cantidadIngresada > stockAnterior) {
      return {
        error: `Stock insuficiente. Stock actual: ${unidadesMinimasATexto(stockAnterior, producto.factorConversion)} ${producto.unidadMedida}`,
      };
    }
    stockPosterior = stockAnterior - cantidadIngresada;
    cantidadRegistrada = cantidadIngresada;
  } else {
    // AJUSTE: cantidadIngresada representa la cantidad real contada (stock nuevo total)
    if (cantidadIngresada < 0) return { error: "La cantidad no puede ser negativa" };
    if (cantidadIngresada === stockAnterior) {
      return { error: "La cantidad ingresada es igual al stock actual, no hay nada que ajustar" };
    }
    stockPosterior = cantidadIngresada;
    cantidadRegistrada = Math.abs(stockPosterior - stockAnterior);
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.movimientoInventario.create({
        productoId,
        tipo,
        cantidad: cantidadRegistrada,
        stockAnterior,
        stockPosterior,
        motivo,
      });

      await tx.producto.update(productoId, { stockActual: stockPosterior });

      await registrarAuditoria(tx, {
        entidad: "MovimientoInventario",
        entidadId: productoId,
        accion: tipo === "AJUSTE" ? "AJUSTAR" : "CREAR",
        detalle: { tipo, cantidad: cantidadRegistrada, stockAnterior, stockPosterior, motivo },
      });
    });
  } catch {
    return { error: "No se pudo registrar el movimiento. Intentá de nuevo." };
  }

  return { exito: true };
}
