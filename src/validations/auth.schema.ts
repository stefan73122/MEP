import { z } from "zod";

export const ingresarPinSchema = z.object({
  pin: z.string().min(1, "Ingresá el PIN"),
});

export type IngresarPinInput = z.infer<typeof ingresarPinSchema>;
