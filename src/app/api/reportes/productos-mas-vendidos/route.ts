import { requireAcceso } from "@/lib/auth";
import { db } from "@/lib/db";
import { centavosATexto } from "@/lib/money";
import { unidadesMinimasATexto } from "@/lib/stock";
import { obtenerProductosMasVendidos, resolverRangoReporte } from "@/lib/reportes";
import { filasACsv, respuestaCsv } from "@/lib/csv";

export async function GET(request: Request) {
  await requireAcceso();

  const { searchParams } = new URL(request.url);
  const { desde, hasta } = resolverRangoReporte(searchParams.get("desde"), searchParams.get("hasta"));

  const productos = await obtenerProductosMasVendidos(db, desde, hasta, 100);

  const filas = productos.map((producto, indice) => [
    indice + 1,
    producto.nombre,
    unidadesMinimasATexto(producto.cantidadVendida, producto.factorConversion),
    producto.unidadMedida,
    centavosATexto(producto.montoVendido),
  ]);

  const csv = filasACsv(["Puesto", "Producto", "Cantidad vendida", "Unidad", "Monto vendido"], filas);

  return respuestaCsv("productos-mas-vendidos.csv", csv);
}
