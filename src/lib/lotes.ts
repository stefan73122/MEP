import type { Prisma, PrismaClient } from "@prisma/client";

type ClientePrisma = PrismaClient | Prisma.TransactionClient;

export type LoteVigente = { id: number; cantidad: number; fechaVencimiento: Date };

// Lotes con stock y todavía no vencidos, del que vence antes al que vence
// después (FEFO: first expired, first out).
export function obtenerLotesVendibles(
  prisma: ClientePrisma,
  productoId: number,
  ahora: Date = new Date(),
): Promise<LoteVigente[]> {
  return prisma.lote.findMany({
    where: { productoId, cantidad: { gt: 0 }, fechaVencimiento: { gte: ahora } },
    orderBy: { fechaVencimiento: "asc" },
    select: { id: true, cantidad: true, fechaVencimiento: true },
  });
}

export async function calcularStockVendible(
  prisma: ClientePrisma,
  productoId: number,
  ahora: Date = new Date(),
): Promise<number> {
  const lotes = await obtenerLotesVendibles(prisma, productoId, ahora);
  return lotes.reduce((acc, lote) => acc + lote.cantidad, 0);
}

export type LoteAfectado = { loteId: number; cantidad: number; fechaVencimiento: Date };

// Descuenta `cantidad` de los lotes vigentes empezando por el que vence antes.
// Los lotes vencidos nunca se tocan (no se pueden vender). Debe llamarse
// dentro de una transacción. Devuelve qué lote(s) se afectaron y en cuánto,
// para poder registrar el/los movimiento(s) de inventario correspondientes.
export async function descontarFEFO(
  tx: Prisma.TransactionClient,
  productoId: number,
  cantidad: number,
  ahora: Date = new Date(),
): Promise<LoteAfectado[]> {
  const lotes = await obtenerLotesVendibles(tx, productoId, ahora);
  const totalVendible = lotes.reduce((acc, lote) => acc + lote.cantidad, 0);

  if (cantidad > totalVendible) {
    throw new Error(
      totalVendible === 0
        ? "No hay lotes vigentes de este producto (puede que estén todos vencidos)"
        : "Stock insuficiente en los lotes vigentes de este producto",
    );
  }

  const afectados: LoteAfectado[] = [];
  let restante = cantidad;

  for (const lote of lotes) {
    if (restante <= 0) break;
    const tomar = Math.min(lote.cantidad, restante);

    await tx.lote.update({
      where: { id: lote.id },
      data: { cantidad: lote.cantidad - tomar },
    });

    afectados.push({ loteId: lote.id, cantidad: tomar, fechaVencimiento: lote.fechaVencimiento });
    restante -= tomar;
  }

  return afectados;
}

export type LoteConProducto = {
  id: number;
  productoId: number;
  productoNombre: string;
  unidadMedida: string;
  factorConversion: number;
  cantidad: number;
  fechaVencimiento: Date;
};

export async function obtenerLotesVencidos(
  prisma: ClientePrisma,
  ahora: Date = new Date(),
): Promise<LoteConProducto[]> {
  const lotes = await prisma.lote.findMany({
    where: { cantidad: { gt: 0 }, fechaVencimiento: { lt: ahora }, producto: { activo: true } },
    include: { producto: true },
    orderBy: { fechaVencimiento: "asc" },
  });
  return lotes.map(mapearLote);
}

export async function obtenerLotesPorVencer(
  prisma: ClientePrisma,
  diasAlerta: number,
  ahora: Date = new Date(),
): Promise<LoteConProducto[]> {
  const limite = new Date(ahora.getTime() + diasAlerta * 24 * 60 * 60 * 1000);
  const lotes = await prisma.lote.findMany({
    where: {
      cantidad: { gt: 0 },
      fechaVencimiento: { gte: ahora, lte: limite },
      producto: { activo: true },
    },
    include: { producto: true },
    orderBy: { fechaVencimiento: "asc" },
  });
  return lotes.map(mapearLote);
}

function mapearLote(lote: {
  id: number;
  productoId: number;
  cantidad: number;
  fechaVencimiento: Date;
  producto: { nombre: string; unidadMedida: string; factorConversion: number };
}): LoteConProducto {
  return {
    id: lote.id,
    productoId: lote.productoId,
    productoNombre: lote.producto.nombre,
    unidadMedida: lote.producto.unidadMedida,
    factorConversion: lote.producto.factorConversion,
    cantidad: lote.cantidad,
    fechaVencimiento: lote.fechaVencimiento,
  };
}
