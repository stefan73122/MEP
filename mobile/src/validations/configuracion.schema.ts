import { z } from "zod";
import { LARGO_PIN } from "@/lib/constants";

export const actualizarConfiguracionSchema = z.object({
  nombreNegocio: z.string().trim().min(1, "Ingresa el nombre del negocio").max(120),
  moneda: z.string().trim().min(1, "Ingresa el código de la moneda").max(10),
  simboloMoneda: z.string().trim().min(1, "Ingresa el símbolo de la moneda").max(10),
  diasAlertaVencimientoTexto: z.string().min(1, "Ingresa con cuántos días de anticipación avisar"),
});

export type ActualizarConfiguracionInput = z.infer<typeof actualizarConfiguracionSchema>;

const pinTexto = z
  .string()
  .trim()
  .regex(/^\d+$/, "El PIN solo puede tener números")
  .length(LARGO_PIN, `El PIN debe tener ${LARGO_PIN} números`);

export const configurarPinSchema = z
  .object({
    pin: pinTexto,
    confirmarPin: z.string().min(1, "Repite el PIN"),
  })
  .refine((datos) => datos.pin === datos.confirmarPin, {
    message: "Los PIN no coinciden",
    path: ["confirmarPin"],
  });

export type ConfigurarPinInput = z.infer<typeof configurarPinSchema>;
