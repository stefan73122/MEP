import { requireAcceso } from "@/lib/auth";
import { db } from "@/lib/db";
import { fechaHoraATexto } from "@/lib/dates";
import { centavosATexto } from "@/lib/money";
import { obtenerGastos, resolverRangoReporte } from "@/lib/reportes";
import { filasACsv, respuestaCsv } from "@/lib/csv";

export async function GET(request: Request) {
  await requireAcceso();

  const { searchParams } = new URL(request.url);
  const { desde, hasta } = resolverRangoReporte(searchParams.get("desde"), searchParams.get("hasta"));

  const gastos = await obtenerGastos(db, desde, hasta);

  const filas = gastos.map((gasto) => [gasto.id, fechaHoraATexto(gasto.fecha), gasto.descripcion, centavosATexto(gasto.monto)]);

  const csv = filasACsv(["Gasto", "Fecha", "Descripción", "Monto"], filas);

  return respuestaCsv("gastos.csv", csv);
}
