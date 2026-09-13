"use client";

import { useCallback, useEffect, useState } from "react";
import { obtenerEstadoLicencia } from "@/lib/licencia";
import { PantallaActivacion } from "./PantallaActivacion";

type Estado = "cargando" | "activada" | "pendiente";

// Envuelve TODA la app (ver layout.tsx raíz), antes que nada más — ni
// siquiera el login por PIN se ve sin licencia activada. La activación es
// 100% local: nunca se consulta ningún servidor.
export function LicenciaGate({ children }: { children: React.ReactNode }) {
  const [estado, setEstado] = useState<Estado>("cargando");
  const [codigoDispositivo, setCodigoDispositivo] = useState("");

  const verificar = useCallback(async () => {
    const { activada, codigoDispositivo: codigo } = await obtenerEstadoLicencia();
    setCodigoDispositivo(codigo);
    setEstado(activada ? "activada" : "pendiente");
  }, []);

  useEffect(() => {
    verificar();
  }, [verificar]);

  if (estado === "cargando") return null;
  if (estado === "pendiente") {
    return <PantallaActivacion codigoDispositivo={codigoDispositivo} onActivada={verificar} />;
  }
  return <>{children}</>;
}
