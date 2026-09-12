import type { Db } from "./db/client";
import type { FormaPago } from "./db/types";
import { DIAS_ALERTA_VENCIMIENTO_DEFECTO } from "./constants";
import { finDelDia, inicioDelDia } from "./dates";

export type ResumenTablero = {
  totalHoy: number;
  cantidadVentasHoy: number;
  efectivoHoy: number;
  creditoHoy: number;
  fiadoPendienteTotal: number;
  productosPorVencer: number;
  productosStockBajo: number;
};

// Todo agregado en SQLite (SUM/COUNT/GROUP BY): ninguna de estas consultas
// trae productos, lotes o ventas a memoria para sumarlos en JS, así que el
// tablero carga rápido sin importar cuántas filas tengan esas tablas.
export async function obtenerResumenTablero(db: Db): Promise<ResumenTablero> {
  const ahora = new Date();

  const [configuracion, porFormaPago, fiadoPendienteTotal, productosStockBajo] = await Promise.all([
    db.configuracion.findFirst(),
    db.venta.resumenPorFormaPagoEnRango(inicioDelDia(ahora), finDelDia(ahora)),
    db.venta.saldoPendienteTotalCredito(),
    db.producto.contarStockBajo(),
  ]);

  const diasAlerta = configuracion?.diasAlertaVencimiento ?? DIAS_ALERTA_VENCIMIENTO_DEFECTO;
  const productosPorVencer = await db.lote.contarProductosPorVencer(ahora, diasAlerta);

  const porForma = (forma: FormaPago) => porFormaPago.find((f) => f.formaPago === forma);

  return {
    totalHoy: porFormaPago.reduce((acc, f) => acc + f.total, 0),
    cantidadVentasHoy: porFormaPago.reduce((acc, f) => acc + f.cantidad, 0),
    efectivoHoy: porForma("EFECTIVO")?.total ?? 0,
    creditoHoy: porForma("CREDITO")?.total ?? 0,
    fiadoPendienteTotal,
    productosPorVencer,
    productosStockBajo,
  };
}
