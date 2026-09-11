import { requireAcceso } from "@/lib/auth";
import { db } from "@/lib/db";
import { centavosATexto } from "@/lib/money";
import { calcularGananciaEstimada, calcularTotalGastos, resolverRangoReporte } from "@/lib/reportes";
import { filasACsv, respuestaCsv } from "@/lib/csv";

export async function GET(request: Request) {
  await requireAcceso();

  const { searchParams } = new URL(request.url);
  const { desde, hasta } = resolverRangoReporte(searchParams.get("desde"), searchParams.get("hasta"));

  const [ganancia, totalGastos] = await Promise.all([
    calcularGananciaEstimada(db, desde, hasta),
    calcularTotalGastos(db, desde, hasta),
  ]);
  const gananciaReal = ganancia.ganancia - totalGastos;

  const csv = filasACsv(
    ["Ingresos", "Costo estimado", "Ganancia estimada", "Gastos", "Ganancia real"],
    [
      [
        centavosATexto(ganancia.ingresos),
        centavosATexto(ganancia.costoEstimado),
        centavosATexto(ganancia.ganancia),
        centavosATexto(totalGastos),
        centavosATexto(gananciaReal),
      ],
    ],
  );

  return respuestaCsv("ganancia-estimada.csv", csv);
}
