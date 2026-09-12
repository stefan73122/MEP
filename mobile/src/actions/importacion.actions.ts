import { db } from "@/lib/db/client";
import { requireAcceso } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";
import { textoACentavos } from "@/lib/money";
import { textoAUnidadesMinimas } from "@/lib/stock";
import { textoAFecha } from "@/lib/dates";
import { leerArchivoImportacion, type FilaImportacion } from "@/lib/excelProductos";

export type EstadoPrevisualizacion = { error?: string; filas?: FilaImportacion[] };

export async function previsualizarImportacion(
  _estadoPrevio: EstadoPrevisualizacion,
  formData: FormData,
): Promise<EstadoPrevisualizacion> {
  await requireAcceso();

  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { error: "Subí un archivo Excel (.xlsx)" };
  }

  const buffer = await archivo.arrayBuffer();
  const { filas, error } = await leerArchivoImportacion(buffer);
  if (error) return { error };
  if (filas.length === 0) {
    return { error: "El archivo no tiene productos para importar" };
  }

  const skusDb = await db.producto.findMany({ skuIn: filas.map((f) => f.sku).filter(Boolean) });
  const skusExistentes = new Set(skusDb.map((p) => p.sku.toLowerCase()));

  const filasConValidacionDb = filas.map((fila) => {
    if (fila.sku && skusExistentes.has(fila.sku.toLowerCase())) {
      return { ...fila, errores: [...fila.errores, "Ya existe un producto con este código"] };
    }
    return fila;
  });

  return { filas: filasConValidacionDb };
}

export type EstadoImportacion = {
  error?: string;
  resultado?: { importados: number; errores: { numero: number; sku: string; mensaje: string }[] };
};

export async function confirmarImportacion(
  _estadoPrevio: EstadoImportacion,
  formData: FormData,
): Promise<EstadoImportacion> {
  await requireAcceso();

  const filasTexto = formData.get("filasJson");
  if (typeof filasTexto !== "string") {
    return { error: "No hay filas para importar" };
  }

  let filas: FilaImportacion[];
  try {
    filas = JSON.parse(filasTexto);
  } catch {
    return { error: "Los datos a importar no son válidos" };
  }

  const filasValidas = filas.filter((f) => f.errores.length === 0);
  if (filasValidas.length === 0) {
    return { error: "No hay filas válidas para importar" };
  }

  const errores: { numero: number; sku: string; mensaje: string }[] = [];
  let importados = 0;

  for (const fila of filasValidas) {
    try {
      const yaExiste = await db.producto.findBySku(fila.sku);
      if (yaExiste) {
        errores.push({ numero: fila.numero, sku: fila.sku, mensaje: "Ya existe un producto con este código" });
        continue;
      }

      const precioCompra = textoACentavos(fila.precioCompraTexto);
      const precioVenta = textoACentavos(fila.precioVentaTexto);
      const stockMinimo = textoAUnidadesMinimas(fila.stockMinimoTexto, fila.factorConversion);
      const stockInicial = fila.perecedero
        ? textoAUnidadesMinimas(fila.cantidadLoteTexto ?? "0", fila.factorConversion)
        : textoAUnidadesMinimas(fila.stockInicialTexto, fila.factorConversion);
      const fechaVencimiento =
        fila.perecedero && fila.fechaVencimientoTexto ? textoAFecha(fila.fechaVencimientoTexto) : null;

      await db.$transaction(async (tx) => {
        const producto = await tx.producto.create({
          sku: fila.sku,
          nombre: fila.nombre,
          categoria: fila.categoria,
          unidadMedida: fila.unidadMedida,
          factorConversion: fila.factorConversion,
          precioCompra,
          precioVenta,
          perecedero: fila.perecedero,
          stockActual: stockInicial,
          stockMinimo,
        });

        if (stockInicial > 0) {
          let loteId: number | undefined;
          if (fila.perecedero && fechaVencimiento) {
            const lote = await tx.lote.create({ productoId: producto.id, cantidad: stockInicial, fechaVencimiento });
            loteId = lote.id;
          }

          await tx.movimientoInventario.create({
            productoId: producto.id,
            loteId,
            tipo: "ENTRADA",
            cantidad: stockInicial,
            stockAnterior: 0,
            stockPosterior: stockInicial,
            motivo: "Importación desde Excel",
          });
        }

        await registrarAuditoria(tx, {
          entidad: "Producto",
          entidadId: producto.id,
          accion: "CREAR",
          detalle: { sku: fila.sku, nombre: fila.nombre, origen: "importacion" },
        });
      });

      importados += 1;
    } catch {
      errores.push({ numero: fila.numero, sku: fila.sku, mensaje: "No se pudo guardar este producto" });
    }
  }

  return { resultado: { importados, errores } };
}
