import { z } from "zod";

const textoOpcional = z
  .string()
  .trim()
  .max(120)
  .optional()
  .transform((valor) => (valor ? valor : undefined));

export const crearClienteSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(120),
  telefono: textoOpcional,
  limiteCreditoTexto: z.string().min(1, "Ingresá el límite de crédito"),
});

export type CrearClienteInput = z.infer<typeof crearClienteSchema>;

export const actualizarClienteSchema = z.object({
  id: z.coerce.number().int().positive(),
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(120),
  telefono: textoOpcional,
  limiteCreditoTexto: z.string().min(1, "Ingresá el límite de crédito"),
});

export type ActualizarClienteInput = z.infer<typeof actualizarClienteSchema>;

export const registrarPagoSchema = z.object({
  clienteId: z.coerce.number().int().positive(),
  montoTexto: z.string().min(1, "Ingresá el monto pagado"),
  observacion: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((valor) => (valor ? valor : undefined)),
});

export type RegistrarPagoInput = z.infer<typeof registrarPagoSchema>;
