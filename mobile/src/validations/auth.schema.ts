import { z } from "zod";
import { LARGO_PIN } from "@/lib/constants";

export const ingresarPinSchema = z.object({
  pin: z.string().regex(/^\d+$/).length(LARGO_PIN, "Ingresá el PIN completo"),
});

export type IngresarPinInput = z.infer<typeof ingresarPinSchema>;
