import { db } from "@/lib/db/client";
import { requireAcceso } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";
import { centavosATexto, textoACentavos } from "@/lib/money";
import { obtenerVentasPendientes } from "@/lib/creditos";
import {
  actualizarClienteSchema,
  crearClienteSchema,
  registrarPagoSchema,
} from "@/validations/cliente.schema";

export type EstadoFormularioCliente = { error?: string; id?: number };
export type EstadoPago = { error?: string; exito?: boolean };

// Alta de cliente al vuelo desde la pantalla de venta a crédito: mismos tres
// campos que el alta normal, pero devuelve el cliente en vez de navegar
// (para no salir de la venta que se está cargando).
export async function crearClienteRapido(
  nombre: string,
  telefono: string,
  limiteCreditoTexto: string,
): Promise<{ error?: string; cliente?: { id: number; nombre: string } }> {
  await requireAcceso();

  const nombreLimpio = nombre.trim();
  if (!nombreLimpio) {
    return { error: "Ingresá el nombre del cliente" };
  }

  let limiteCredito: number;
  try {
    limiteCredito = textoACentavos(limiteCreditoTexto);
  } catch (error) {
    return { error: (error as Error).message };
  }
  if (limiteCredito < 0) {
    return { error: "El límite de crédito no puede ser negativo" };
  }

  try {
    const cliente = await db.$transaction(async (tx) => {
      const nuevo = await tx.cliente.create({ nombre: nombreLimpio, telefono: telefono.trim() || null, limiteCredito });

      await registrarAuditoria(tx, {
        entidad: "Cliente",
        entidadId: nuevo.id,
        accion: "CREAR",
        detalle: { nombre: nombreLimpio, origen: "venta_rapida" },
      });

      return nuevo;
    });

    return { cliente: { id: cliente.id, nombre: cliente.nombre } };
  } catch {
    return { error: "No se pudo crear el cliente. Intentá de nuevo." };
  }
}

export async function crearCliente(
  _estadoPrevio: EstadoFormularioCliente,
  formData: FormData,
): Promise<EstadoFormularioCliente> {
  await requireAcceso();

  const resultado = crearClienteSchema.safeParse(Object.fromEntries(formData));
  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const datos = resultado.data;

  let limiteCredito: number;
  try {
    limiteCredito = textoACentavos(datos.limiteCreditoTexto);
  } catch (error) {
    return { error: (error as Error).message };
  }
  if (limiteCredito < 0) {
    return { error: "El límite de crédito no puede ser negativo" };
  }

  try {
    const clienteId = await db.$transaction(async (tx) => {
      const cliente = await tx.cliente.create({
        nombre: datos.nombre,
        telefono: datos.telefono ?? null,
        limiteCredito,
      });

      await registrarAuditoria(tx, {
        entidad: "Cliente",
        entidadId: cliente.id,
        accion: "CREAR",
        detalle: { nombre: datos.nombre },
      });

      return cliente.id;
    });

    return { id: clienteId };
  } catch {
    return { error: "No se pudo guardar el cliente. Intentá de nuevo." };
  }
}

export async function actualizarCliente(
  _estadoPrevio: EstadoFormularioCliente,
  formData: FormData,
): Promise<EstadoFormularioCliente> {
  await requireAcceso();

  const resultado = actualizarClienteSchema.safeParse(Object.fromEntries(formData));
  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const datos = resultado.data;

  const clienteActual = await db.cliente.findUnique(datos.id);
  if (!clienteActual) {
    return { error: "El cliente no existe" };
  }

  let limiteCredito: number;
  try {
    limiteCredito = textoACentavos(datos.limiteCreditoTexto);
  } catch (error) {
    return { error: (error as Error).message };
  }
  if (limiteCredito < 0) {
    return { error: "El límite de crédito no puede ser negativo" };
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.cliente.update(datos.id, {
        nombre: datos.nombre,
        telefono: datos.telefono ?? null,
        limiteCredito,
      });

      await registrarAuditoria(tx, {
        entidad: "Cliente",
        entidadId: datos.id,
        accion: "ACTUALIZAR",
        detalle: { nombre: datos.nombre, limiteCredito },
      });
    });
  } catch {
    return { error: "No se pudo actualizar el cliente. Intentá de nuevo." };
  }

  return { id: datos.id };
}

export async function cambiarEstadoCliente(clienteId: number, activo: boolean): Promise<void> {
  await requireAcceso();

  await db.$transaction(async (tx) => {
    await tx.cliente.update(clienteId, { activo });
    await registrarAuditoria(tx, {
      entidad: "Cliente",
      entidadId: clienteId,
      accion: "ACTUALIZAR",
      detalle: { activo },
    });
  });
}

// Aplica el pago a las ventas a crédito pendientes más antiguas primero,
// hasta agotar el monto pagado (o hasta cubrir toda la deuda).
export async function registrarPago(
  _estadoPrevio: EstadoPago,
  formData: FormData,
): Promise<EstadoPago> {
  await requireAcceso();

  const resultado = registrarPagoSchema.safeParse(Object.fromEntries(formData));
  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { clienteId, montoTexto, observacion } = resultado.data;

  const cliente = await db.cliente.findUnique(clienteId);
  if (!cliente || !cliente.activo) {
    return { error: "El cliente no existe o está inactivo" };
  }

  let monto: number;
  try {
    monto = textoACentavos(montoTexto);
  } catch (error) {
    return { error: (error as Error).message };
  }
  if (monto <= 0) {
    return { error: "El monto debe ser mayor a cero" };
  }

  const ventasPendientes = await obtenerVentasPendientes(db, clienteId);
  const saldoTotal = ventasPendientes.reduce((acc, v) => acc + v.saldoPendiente, 0);
  if (ventasPendientes.length === 0) {
    return { error: `${cliente.nombre} no tiene deudas pendientes` };
  }
  if (monto > saldoTotal) {
    return { error: `El monto supera la deuda total del cliente (${centavosATexto(saldoTotal)})` };
  }

  try {
    await db.$transaction(async (tx) => {
      const pago = await tx.pago.create({ clienteId, monto, observacion: observacion ?? null });

      let montoRestante = monto;
      for (const venta of ventasPendientes) {
        if (montoRestante <= 0) break;
        const montoAplicado = Math.min(venta.saldoPendiente, montoRestante);

        await tx.pagoVenta.create({ pagoId: pago.id, ventaId: venta.id, montoAplicado });

        montoRestante -= montoAplicado;
      }

      await registrarAuditoria(tx, {
        entidad: "Pago",
        entidadId: pago.id,
        accion: "PAGAR",
        detalle: { clienteId, monto },
      });
    });
  } catch {
    return { error: "No se pudo registrar el pago. Intentá de nuevo." };
  }

  return { exito: true };
}
