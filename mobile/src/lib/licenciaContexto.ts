"use client";

import { createContext, useContext } from "react";
import type { DatosCertificado } from "./certificadoLicencia";

// Lo provee LicenciaGate (que envuelve toda la app) una vez que la licencia
// está vigente. Lo usa Ajustes > Licencia para mostrar la cuenta y cerrar
// sesión.
export type ContextoLicencia = {
  codigoDispositivo: string;
  datos: DatosCertificado;
  cerrarSesion: () => Promise<void>;
};

export const LicenciaContext = createContext<ContextoLicencia | null>(null);

export function useLicencia(): ContextoLicencia | null {
  return useContext(LicenciaContext);
}
