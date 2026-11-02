import { z } from "zod";

const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((valor) => (valor ? valor : undefined));

export const servicioSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(120),
  precioTexto: z.string().min(1, "Ingresa el precio"),
  duracionTexto: textoOpcional(10),
  descripcion: textoOpcional(300),
});

export type ServicioInput = z.infer<typeof servicioSchema>;

export const actualizarServicioSchema = servicioSchema.extend({
  id: z.coerce.number().int().positive(),
});
