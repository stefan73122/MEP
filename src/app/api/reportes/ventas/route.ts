import { requireAcceso } from "@/lib/auth";
import { db } from "@/lib/db";
import { fechaHoraATexto } from "@/lib/dates";
import { centavosATexto } from "@/lib/money";
import { obtenerVentasCompletadas, resolverRangoReporte } from "@/lib/reportes";
import { filasACsv, respuestaCsv } from "@/lib/csv";

export async function GET(request: Request) {
  await requireAcceso();

  const { searchParams } = new URL(request.url);
  const { desde, hasta } = resolverRangoReporte(searchParams.get("desde"), searchParams.get("hasta"));

  const ventas = await obtenerVentasCompletadas(db, desde, hasta);
  const clientes = await db.cliente.findMany({ where: { id: { in: ventas.flatMap((v) => (v.clienteId ? [v.clienteId] : [])) } } });
  const nombresClientes = new Map(clientes.map((c) => [c.id, c.nombre]));

  const filas = ventas.map((venta) => [
    venta.id,
    fechaHoraATexto(venta.fecha),
    venta.clienteId ? (nombresClientes.get(venta.clienteId) ?? "") : "Cliente ocasional",
    venta.formaPago,
    centavosATexto(venta.subtotal),
    centavosATexto(venta.descuento),
    centavosATexto(venta.total),
  ]);

  const csv = filasACsv(
    ["Venta", "Fecha", "Cliente", "Forma de pago", "Subtotal", "Descuento", "Total"],
    filas,
  );

  return respuestaCsv("ventas.csv", csv);
}
