import type { Db } from "./db/client";
import type { VentaConPagos } from "./db/types";

function saldoPendienteDeVenta(venta: VentaConPagos): number {
  const aplicado = venta.pagosAplicados.reduce((suma, pago) => suma + pago.montoAplicado, 0);
  return venta.total - aplicado;
}

// Saldo pendiente de un cliente: suma de sus ventas a crédito completadas,
// menos los pagos ya aplicados a esas ventas (ver PagoVenta).
export async function calcularSaldoPendiente(db: Db, clienteId: number): Promise<number> {
  const ventas = await db.venta.findManyConPagos({ clienteId, formaPago: "CREDITO", estado: "COMPLETADA" });
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
export async function obtenerCuentasPorCobrar(db: Db): Promise<CuentaPorCobrar[]> {
  const clientes = await db.cliente.findMany({ activo: true });

  const cuentas: CuentaPorCobrar[] = [];

  for (const c of clientes) {
    const ventas = await db.venta.findManyConPagos({ clienteId: c.id, formaPago: "CREDITO", estado: "COMPLETADA" });

    let saldoPendiente = 0;
    let fechaMasAntigua: Date | null = null;

    for (const venta of ventas) {
      const pendiente = saldoPendienteDeVenta(venta);
      if (pendiente <= 0) continue;
      saldoPendiente += pendiente;
      if (!fechaMasAntigua || venta.fecha < fechaMasAntigua) {
        fechaMasAntigua = venta.fecha;
      }
    }

    if (saldoPendiente > 0 && fechaMasAntigua) {
      cuentas.push({ clienteId: c.id, nombre: c.nombre, saldoPendiente, fechaMasAntigua });
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
export async function obtenerVentasPendientes(db: Db, clienteId: number): Promise<VentaConSaldo[]> {
  const ventas = await db.venta.findManyConPagos(
    { clienteId, formaPago: "CREDITO", estado: "COMPLETADA" },
    { orderBy: "asc" },
  );

  return ventas
    .map((venta) => ({
      id: venta.id,
      fecha: venta.fecha,
      total: venta.total,
      saldoPendiente: saldoPendienteDeVenta(venta),
    }))
    .filter((venta) => venta.saldoPendiente > 0);
}
