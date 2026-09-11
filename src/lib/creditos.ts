import type { Prisma, PrismaClient } from "@prisma/client";

type ClientePrisma = PrismaClient | Prisma.TransactionClient;

type VentaConPagos = {
  total: number;
  pagosAplicados: { montoAplicado: number }[];
};

function saldoPendienteDeVenta(venta: VentaConPagos): number {
  const aplicado = venta.pagosAplicados.reduce((suma, pago) => suma + pago.montoAplicado, 0);
  return venta.total - aplicado;
}

// Saldo pendiente de un cliente: suma de sus ventas a crédito completadas,
// menos los pagos ya aplicados a esas ventas (ver modelo PagoVenta).
export async function calcularSaldoPendiente(
  prisma: ClientePrisma,
  clienteId: number,
): Promise<number> {
  const ventas = await prisma.venta.findMany({
    where: { clienteId, formaPago: "CREDITO", estado: "COMPLETADA" },
    include: { pagosAplicados: true },
  });

  return ventas.reduce((total, venta) => total + saldoPendienteDeVenta(venta), 0);
}

export type CuentaPorCobrar = {
  clienteId: number;
  nombre: string;
  saldoPendiente: number;
  fechaMasAntigua: Date;
};

// Clientes activos con saldo pendiente, ordenados del más antiguo al más
// reciente según su deuda sin pagar más vieja (para priorizar el cobro).
export async function obtenerCuentasPorCobrar(prisma: ClientePrisma): Promise<CuentaPorCobrar[]> {
  const clientes = await prisma.cliente.findMany({
    where: { activo: true },
    include: {
      ventas: {
        where: { formaPago: "CREDITO", estado: "COMPLETADA" },
        include: { pagosAplicados: true },
      },
    },
  });

  const cuentas: CuentaPorCobrar[] = [];

  for (const cliente of clientes) {
    let saldoPendiente = 0;
    let fechaMasAntigua: Date | null = null;

    for (const venta of cliente.ventas) {
      const pendiente = saldoPendienteDeVenta(venta);
      if (pendiente <= 0) continue;
      saldoPendiente += pendiente;
      if (!fechaMasAntigua || venta.fecha < fechaMasAntigua) {
        fechaMasAntigua = venta.fecha;
      }
    }

    if (saldoPendiente > 0 && fechaMasAntigua) {
      cuentas.push({ clienteId: cliente.id, nombre: cliente.nombre, saldoPendiente, fechaMasAntigua });
    }
  }

  return cuentas.sort((a, b) => a.fechaMasAntigua.getTime() - b.fechaMasAntigua.getTime());
}

export type VentaConSaldo = {
  id: number;
  fecha: Date;
  total: number;
  saldoPendiente: number;
};

// Ventas a crédito de un cliente que todavía tienen saldo, de la más vieja a
// la más nueva. Sirve tanto para mostrar el estado de cuenta como para
// aplicar un pago nuevo en orden (la deuda más antigua se cobra primero).
export async function obtenerVentasPendientes(
  prisma: ClientePrisma,
  clienteId: number,
): Promise<VentaConSaldo[]> {
  const ventas = await prisma.venta.findMany({
    where: { clienteId, formaPago: "CREDITO", estado: "COMPLETADA" },
    include: { pagosAplicados: true },
    orderBy: { fecha: "asc" },
  });

  return ventas
    .map((venta) => ({
      id: venta.id,
      fecha: venta.fecha,
      total: venta.total,
      saldoPendiente: saldoPendienteDeVenta(venta),
    }))
    .filter((venta) => venta.saldoPendiente > 0);
}
