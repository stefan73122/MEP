import { z } from "zod";

export const registrarGastoSchema = z.object({
  montoTexto: z.string().min(1, "Ingresa el monto"),
  descripcion: z.string().trim().min(1, "Describe brevemente en qué fue el gasto").max(200),
});

export type RegistrarGastoInput = z.infer<typeof registrarGastoSchema>;
