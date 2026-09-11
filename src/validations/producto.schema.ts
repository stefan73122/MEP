import { z } from "zod";
import { TIPOS_VENTA } from "@/lib/constants";

const textoOpcional = z
  .string()
  .trim()
  .max(60)
  .optional()
  .transform((valor) => (valor ? valor : undefined));

const checkboxABooleano = z
  .string()
  .optional()
  .transform((valor) => valor === "on" || valor === "true");

export const crearProductoSchema = z.object({
  sku: z.string().trim().min(1, "El código es obligatorio").max(40),
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(120),
  categoria: textoOpcional,
  tipoVenta: z.enum(TIPOS_VENTA, { message: "Elegí cómo se vende el producto" }),
  unidadMedidaPersonalizada: z.string().trim().max(20).optional(),
  precioCompraTexto: z.string().min(1, "Ingresá el precio de compra"),
  precioVentaTexto: z.string().min(1, "Ingresá el precio de venta"),
  stockMinimoTexto: z.string().min(1, "Ingresá el stock mínimo"),
  stockInicialTexto: z
    .string()
    .optional()
    .transform((valor) => (valor ? valor : "0")),
  perecedero: checkboxABooleano,
  fechaVencimientoInicialTexto: z
    .string()
    .optional()
    .transform((valor) => (valor ? valor : undefined)),
});

export type CrearProductoInput = z.infer<typeof crearProductoSchema>;

export const actualizarProductoSchema = z.object({
  id: z.coerce.number().int().positive(),
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(120),
  categoria: textoOpcional,
  precioCompraTexto: z.string().min(1, "Ingresá el precio de compra"),
  precioVentaTexto: z.string().min(1, "Ingresá el precio de venta"),
  stockMinimoTexto: z.string().min(1, "Ingresá el stock mínimo"),
});

export type ActualizarProductoInput = z.infer<typeof actualizarProductoSchema>;

// Movimiento genérico: solo para productos NO perecederos (sin lotes).
export const movimientoSchema = z.object({
  productoId: z.coerce.number().int().positive(),
  tipo: z.enum(["ENTRADA", "SALIDA", "AJUSTE"], { message: "Elegí el tipo de movimiento" }),
  cantidadTexto: z.string().min(1, "Ingresá la cantidad"),
  motivo: z.string().trim().min(3, "Contá brevemente el motivo (mínimo 3 caracteres)").max(200),
});

export type MovimientoInput = z.infer<typeof movimientoSchema>;

// Entrada de un lote nuevo (productos perecederos).
export const entradaLoteSchema = z.object({
  productoId: z.coerce.number().int().positive(),
  cantidadTexto: z.string().min(1, "Ingresá la cantidad"),
  fechaVencimientoTexto: z.string().min(1, "Ingresá la fecha de vencimiento"),
  motivo: z.string().trim().min(3, "Contá brevemente el motivo (mínimo 3 caracteres)").max(200),
});

export type EntradaLoteInput = z.infer<typeof entradaLoteSchema>;

// Salida/merma de un producto perecedero: se descuenta FEFO, sin elegir lote.
export const salidaLoteSchema = z.object({
  productoId: z.coerce.number().int().positive(),
  cantidadTexto: z.string().min(1, "Ingresá la cantidad"),
  motivo: z.string().trim().min(3, "Contá brevemente el motivo (mínimo 3 caracteres)").max(200),
});

export type SalidaLoteInput = z.infer<typeof salidaLoteSchema>;

// Corrección puntual de un lote (conteo real de ese lote específico).
export const ajusteLoteSchema = z.object({
  loteId: z.coerce.number().int().positive(),
  cantidadRealTexto: z.string().min(1, "Ingresá la cantidad real"),
  motivo: z.string().trim().min(3, "Contá brevemente el motivo (mínimo 3 caracteres)").max(200),
});

export type AjusteLoteInput = z.infer<typeof ajusteLoteSchema>;
