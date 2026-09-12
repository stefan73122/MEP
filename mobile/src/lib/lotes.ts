import type { Db } from "./db/client";
import type { LoteConProducto } from "./db/types";

export type LoteVigente = { id: number; cantidad: number; fechaVencimiento: Date };

// Lotes con stock, del que vence antes al que vence después (FEFO: first
// expired, first out) — incluye lotes ya vencidos a propósito, para que el
// stock vencido se pueda vender/descontar igual (ver findVendibles).
export function obtenerLotesVendibles(
  db: Db,
  productoId: number,
  ahora: Date = new Date(),
): Promise<LoteVigente[]> {
  return db.lote.findVendibles(productoId, ahora);
}

export async function calcularStockVendible(
  db: Db,
  productoId: number,
  ahora: Date = new Date(),
): Promise<number> {
  const lotes = await obtenerLotesVendibles(db, productoId, ahora);
  return lotes.reduce((acc, l) => acc + l.cantidad, 0);
}

export type LoteAfectado = { loteId: number; cantidad: number; fechaVencimiento: Date };

// Descuenta `cantidad` de los lotes empezando por el que vence antes — los
// lotes ya vencidos entran primero en ese orden, así que se descuentan
// antes que los vigentes (no hace falta lógica aparte para venderlos).
// Debe llamarse dentro de una transacción ($transaction). Devuelve qué
// lote(s) se afectaron y en cuánto, para poder registrar el/los
// movimiento(s) de inventario.
export async function descontarFEFO(
  tx: Db,
  productoId: number,
  cantidad: number,
  ahora: Date = new Date(),
): Promise<LoteAfectado[]> {
  const lotes = await obtenerLotesVendibles(tx, productoId, ahora);
  const totalVendible = lotes.reduce((acc, l) => acc + l.cantidad, 0);

  if (cantidad > totalVendible) {
    throw new Error(
      totalVendible === 0
        ? "No hay lotes de este producto con stock"
        : "Stock insuficiente en los lotes de este producto",
    );
  }

  const afectados: LoteAfectado[] = [];
  let restante = cantidad;

  for (const l of lotes) {
    if (restante <= 0) break;
    const tomar = Math.min(l.cantidad, restante);

    await tx.lote.update(l.id, { cantidad: l.cantidad - tomar });

    afectados.push({ loteId: l.id, cantidad: tomar, fechaVencimiento: l.fechaVencimiento });
    restante -= tomar;
  }

  return afectados;
}

export async function obtenerLotesVencidos(db: Db, ahora: Date = new Date()): Promise<LoteConProducto[]> {
  return db.lote.findVencidos(ahora);
}

export async function obtenerLotesPorVencer(
  db: Db,
  diasAlerta: number,
  ahora: Date = new Date(),
): Promise<LoteConProducto[]> {
  return db.lote.findPorVencer(ahora, diasAlerta);
}
