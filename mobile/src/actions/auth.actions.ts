import { db } from "@/lib/db/client";
import { marcarDesbloqueado, verificarPin } from "@/lib/auth";
import { ingresarPinSchema } from "@/validations/auth.schema";

export type EstadoLogin = { error?: string; exito?: boolean };

export async function ingresarConPinAction(
  _estadoPrevio: EstadoLogin,
  formData: FormData,
): Promise<EstadoLogin> {
  const resultado = ingresarPinSchema.safeParse(Object.fromEntries(formData));
  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const configuracion = await db.configuracion.findFirst();
  if (!configuracion?.bloqueoActivado || !configuracion.pinHash) {
    // El bloqueo se desactivó mientras se mostraba esta pantalla: no hace falta validar nada.
    marcarDesbloqueado();
    return { exito: true };
  }

  const pinValido = await verificarPin(resultado.data.pin, configuracion.pinHash);
  if (!pinValido) {
    return { error: "PIN incorrecto" };
  }

  marcarDesbloqueado();
  return { exito: true };
}
