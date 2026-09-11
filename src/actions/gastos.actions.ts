"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAcceso } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";
import { textoACentavos } from "@/lib/money";
import { registrarGastoSchema } from "@/validations/gasto.schema";

export type EstadoGasto = { error?: string; exito?: boolean };

export async function registrarGasto(
  _estadoPrevio: EstadoGasto,
  formData: FormData,
): Promise<EstadoGasto> {
  await requireAcceso();

  const resultado = registrarGastoSchema.safeParse(Object.fromEntries(formData));
  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Datos inválidos" };
  }

  let monto: number;
  try {
    monto = textoACentavos(resultado.data.montoTexto);
  } catch (error) {
    return { error: (error as Error).message };
  }
  if (monto <= 0) {
    return { error: "El monto debe ser mayor a cero" };
  }

  try {
    await db.$transaction(async (tx) => {
      const gasto = await tx.gasto.create({
        data: { monto, descripcion: resultado.data.descripcion },
      });

      await registrarAuditoria(tx, {
        entidad: "Gasto",
        entidadId: gasto.id,
        accion: "CREAR",
        detalle: { monto, descripcion: resultado.data.descripcion },
      });
    });
  } catch {
    return { error: "No se pudo registrar el gasto. Intentá de nuevo." };
  }

  revalidatePath("/reportes");
  return { exito: true };
}

export async function borrarGasto(gastoId: number): Promise<void> {
  await requireAcceso();

  await db.$transaction(async (tx) => {
    await tx.gasto.delete({ where: { id: gastoId } });
    await registrarAuditoria(tx, {
      entidad: "Gasto",
      entidadId: gastoId,
      accion: "ANULAR",
    });
  });

  revalidatePath("/reportes");
}
