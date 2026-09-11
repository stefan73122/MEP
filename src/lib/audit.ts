import type { Prisma, PrismaClient } from "@prisma/client";
import type { AccionAuditoria } from "./constants";

type ClientePrisma = PrismaClient | Prisma.TransactionClient;

type ParametrosAuditoria = {
  entidad: string;
  entidadId: number;
  accion: AccionAuditoria;
  detalle?: Record<string, unknown>;
};

// Se llama dentro de las mismas transacciones que crean/modifican ventas,
// movimientos de inventario y pagos, para que el registro de auditoría quede
// atado a la misma operación (todo o nada). Sistema de un solo usuario: no
// se guarda quién lo hizo, solo qué pasó y cuándo.
export async function registrarAuditoria(
  cliente: ClientePrisma,
  { entidad, entidadId, accion, detalle }: ParametrosAuditoria,
): Promise<void> {
  await cliente.auditLog.create({
    data: {
      entidad,
      entidadId,
      accion,
      detalle: detalle ? JSON.stringify(detalle) : null,
    },
  });
}
