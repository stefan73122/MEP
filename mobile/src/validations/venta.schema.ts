import { z } from "zod";
import { FORMAS_PAGO } from "@/lib/constants";

export const itemVentaSchema = z.object({
  productoId: z.number().int().positive(),
  cantidadTexto: z.string().min(1),
  descuentoTexto: z.string().optional(),
});

export type ItemVentaInput = z.infer<typeof itemVentaSchema>;

// Puede venir vacío si la atención tiene solo servicios: que haya al menos
// un producto o un servicio lo controla crearVenta.
export const itemsVentaArraySchema = z.array(itemVentaSchema);

// Servicio dentro de una atención: el precio llega del formulario porque es
// editable al atender (el del servicio es solo el sugerido).
export const itemServicioSchema = z.object({
  servicioId: z.number().int().positive(),
  precioTexto: z.string().min(1, "Ingresa el precio del servicio"),
  cantidadTexto: z.string().min(1),
  descuentoTexto: z.string().optional(),
});

export const serviciosVentaArraySchema = z.array(itemServicioSchema);

const clienteIdOpcional = z.preprocess(
  (valor) => (typeof valor === "string" && valor.trim() === "" ? undefined : valor),
  z.coerce.number().int().positive().optional(),
);

export const crearVentaSchema = z.object({
  clienteId: clienteIdOpcional,
  formaPago: z.enum(FORMAS_PAGO, { message: "Elige la forma de pago" }),
  descuentoTotalTexto: z.string().optional(),
  itemsJson: z
    .string()
    .optional()
    .transform((valor) => valor || "[]"),
  serviciosJson: z
    .string()
    .optional()
    .transform((valor) => valor || "[]"),
  nota: z
    .string()
    .trim()
    .max(300, "La nota puede tener hasta 300 caracteres")
    .optional()
    .transform((valor) => (valor ? valor : undefined)),
  // Se manda en "1" cuando el usuario ya vio la alerta de límite de crédito
  // superado y confirmó que quiere vender igual.
  confirmarExcesoCredito: z.string().optional(),
});

export type CrearVentaInput = z.infer<typeof crearVentaSchema>;

export const anularVentaSchema = z.object({
  ventaId: z.coerce.number().int().positive(),
  motivo: z.string().trim().min(3, "Describe brevemente el motivo (mínimo 3 caracteres)").max(200),
});

export type AnularVentaInput = z.infer<typeof anularVentaSchema>;
