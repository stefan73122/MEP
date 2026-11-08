import { WebPlugin } from "@capacitor/core";
import type { LicenciaNativaPlugin } from "./licenciaNativa";

// Implementación SOLO para desarrollo en el navegador (`next dev`). Ojo: este
// archivo SÍ termina dentro del APK (como un chunk aparte del build), así que
// nunca debe contener nada secreto.
export class LicenciaNativaWeb extends WebPlugin implements LicenciaNativaPlugin {
  async verificarFirma(): Promise<{ valida: boolean }> {
    // No hay APK ni firma que comprobar corriendo en el navegador.
    return { valida: true };
  }
}
