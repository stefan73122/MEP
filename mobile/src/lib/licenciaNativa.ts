import { registerPlugin } from "@capacitor/core";

// Plugin nativo Android (ver
// android/app/src/main/java/com/mitienda/app/LicenciaPlugin.java). Solo
// comprueba la firma del APK: la licencia la valida el servidor (Supabase) y
// la app la verifica con un certificado firmado — ver licencia.ts.
export interface LicenciaNativaPlugin {
  verificarFirma(): Promise<{ valida: boolean }>;
}

const LicenciaNativa = registerPlugin<LicenciaNativaPlugin>("LicenciaNativa", {
  // Solo para `next dev` en el navegador: en el APK real esto lo resuelve
  // siempre la implementación nativa de arriba.
  web: () => import("./licenciaNativaWeb").then((m) => new m.LicenciaNativaWeb()),
});

export default LicenciaNativa;
