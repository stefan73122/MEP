import { db } from "@/lib/db/client";
import { requireAcceso } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";
import { textoACentavos } from "@/lib/money";
import { ErrorRestriccionUnica } from "@/lib/db/types";
import { actualizarServicioSchema, servicioSchema, type ServicioInput } from "@/validations/servicio.schema";

export type EstadoFormularioServicio = { error?: string; id?: number; exito?: boolean };

type DatosServicio = { precio: number; duracionMinutos: number | null; descripcion: string | null };

function convertir(datos: ServicioInput): DatosServicio | { error: string } {
  let precio: number;
  try {
    precio = textoACentavos(datos.precioTexto);
  } catch (error) {
    return { error: (error as Error).message };
  }
  if (precio < 0) return { error: "El precio no puede ser negativo" };

  let duracionMinutos: number | null = null;
  if (datos.duracionTexto) {
    const minutos = Number(datos.duracionTexto.replace(",", "."));
    if (!Number.isInteger(minutos) || minutos <= 0) {
      return { error: "La duración tiene que ser una cantidad entera de minutos" };
    }
    duracionMinutos = minutos;
  }

  return { precio, duracionMinutos, descripcion: datos.descripcion ?? null };
}

export async function crearServicio(
  _estadoPrevio: EstadoFormularioServicio,
  formData: FormData,
): Promise<EstadoFormularioServicio> {
  await requireAcceso();

  const resultado = servicioSchema.safeParse(Object.fromEntries(formData));
  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const convertido = convertir(resultado.data);
  if ("error" in convertido) return { error: convertido.error };

  if (await db.servicio.findByNombre(resultado.data.nombre)) {
    return { error: "Ya existe un servicio con ese nombre" };
  }

  try {
    const id = await db.$transaction(async (tx) => {
      const servicio = await tx.servicio.create({ nombre: resultado.data.nombre, ...convertido });
      await registrarAuditoria(tx, {
        entidad: "Servicio",
        entidadId: servicio.id,
        accion: "CREAR",
        detalle: { nombre: servicio.nombre, precio: servicio.precio },
      });
      return servicio.id;
    });
    return { id };
  } catch (error) {
    if (error instanceof ErrorRestriccionUnica) return { error: "Ya existe un servicio con ese nombre" };
    return { error: "No se pudo guardar el servicio. Intenta de nuevo." };
  }
}

export async function actualizarServicio(
  _estadoPrevio: EstadoFormularioServicio,
  formData: FormData,
): Promise<EstadoFormularioServicio> {
  await requireAcceso();

  const resultado = actualizarServicioSchema.safeParse(Object.fromEntries(formData));
  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const convertido = convertir(resultado.data);
  if ("error" in convertido) return { error: convertido.error };

  const { id, nombre } = resultado.data;
  const mismoNombre = await db.servicio.findByNombre(nombre);
  if (mismoNombre && mismoNombre.id !== id) {
    return { error: "Ya existe otro servicio con ese nombre" };
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.servicio.update(id, { nombre, ...convertido });
      await registrarAuditoria(tx, {
        entidad: "Servicio",
        entidadId: id,
        accion: "ACTUALIZAR",
        detalle: { nombre, precio: convertido.precio },
      });
    });
  } catch {
    return { error: "No se pudo guardar el servicio. Intenta de nuevo." };
  }
  return { exito: true };
}

// Desactivar en vez de borrar: las atenciones ya registradas lo siguen
// mostrando en su detalle y en los reportes.
export async function cambiarEstadoServicio(id: number, activo: boolean): Promise<void> {
  await requireAcceso();
  await db.$transaction(async (tx) => {
    await tx.servicio.update(id, { activo });
    await registrarAuditoria(tx, {
      entidad: "Servicio",
      entidadId: id,
      accion: "ACTUALIZAR",
      detalle: { activo },
    });
  });
}
