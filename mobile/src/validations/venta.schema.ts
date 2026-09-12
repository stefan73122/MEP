import { z } from "zod";
import { FORMAS_PAGO } from "@/lib/constants";

export const itemVentaSchema = z.object({
  productoId: z.number().int().positive(),
  cantidadTexto: z.string().min(1),
  descuentoTexto: z.string().optional(),
});

export type ItemVentaInput = z.infer<typeof itemVentaSchema>;

export const itemsVentaArraySchema = z
  .array(itemVentaSchema)
  .min(1, "Agregá al menos un producto al carrito");

const clienteIdOpcional = z.preprocess(
  (valor) => (typeof valor === "string" && valor.trim() === "" ? undefined : valor),
  z.coerce.number().int().positive().optional(),
);

export const crearVentaSchema = z.object({
  clienteId: clienteIdOpcional,
  formaPago: z.enum(FORMAS_PAGO, { message: "Elegí la forma de pago" }),
  descuentoTotalTexto: z.string().optional(),
  itemsJson: z.string().min(1, "Agregá al menos un producto al carrito"),
  // Se manda en "1" cuando el usuario ya vio la alerta de límite de crédito
  // superado y confirmó que quiere vender igual.
  confirmarExcesoCredito: z.string().optional(),
});

export type CrearVentaInput = z.infer<typeof crearVentaSchema>;

export const anularVentaSchema = z.object({
  ventaId: z.coerce.number().int().positive(),
  motivo: z.string().trim().min(3, "Contá brevemente el motivo (mínimo 3 caracteres)").max(200),
});

export type AnularVentaInput = z.infer<typeof anularVentaSchema>;
