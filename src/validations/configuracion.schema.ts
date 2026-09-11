import { z } from "zod";
import { LARGO_PIN_MAXIMO, LARGO_PIN_MINIMO } from "@/lib/constants";

export const actualizarConfiguracionSchema = z.object({
  nombreNegocio: z.string().trim().min(1, "Ingresá el nombre del negocio").max(120),
  moneda: z.string().trim().min(1, "Ingresá el código de la moneda").max(10),
  simboloMoneda: z.string().trim().min(1, "Ingresá el símbolo de la moneda").max(10),
  diasAlertaVencimientoTexto: z.string().min(1, "Ingresá con cuántos días de anticipación avisar"),
});

export type ActualizarConfiguracionInput = z.infer<typeof actualizarConfiguracionSchema>;

const pinTexto = z
  .string()
  .trim()
  .regex(/^\d+$/, "El PIN solo puede tener números")
  .min(LARGO_PIN_MINIMO, `El PIN debe tener entre ${LARGO_PIN_MINIMO} y ${LARGO_PIN_MAXIMO} números`)
  .max(LARGO_PIN_MAXIMO, `El PIN debe tener entre ${LARGO_PIN_MINIMO} y ${LARGO_PIN_MAXIMO} números`);

export const configurarPinSchema = z
  .object({
    pin: pinTexto,
    confirmarPin: z.string().min(1, "Repetí el PIN"),
  })
  .refine((datos) => datos.pin === datos.confirmarPin, {
    message: "Los PIN no coinciden",
    path: ["confirmarPin"],
  });

export type ConfigurarPinInput = z.infer<typeof configurarPinSchema>;
