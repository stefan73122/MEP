import { registerPlugin } from "@capacitor/core";

// El JavaScript de la app queda empaquetado como texto plano dentro del APK
// (cualquier descompresor lo lee) — por eso la palabra secreta y el cálculo
// de la clave NO viven acá, sino en el plugin nativo Android (ver
// android/app/src/main/java/com/mitienda/app/LicenciaPlugin.java). Esta
// interfaz solo manda el código de dispositivo y lo que el usuario escribió,
// y recibe un booleano de vuelta — nunca la clave correcta.
export interface LicenciaNativaPlugin {
  validarClave(opciones: { codigoDispositivo: string; clave: string }): Promise<{ valida: boolean }>;
  verificarFirma(): Promise<{ valida: boolean }>;
}

const LicenciaNativa = registerPlugin<LicenciaNativaPlugin>("LicenciaNativa", {
  // Solo para `next dev` en el navegador: en el APK real esto lo resuelve
  // siempre la implementación nativa de arriba.
  web: () => import("./licenciaNativaWeb").then((m) => new m.LicenciaNativaWeb()),
});

export default LicenciaNativa;
