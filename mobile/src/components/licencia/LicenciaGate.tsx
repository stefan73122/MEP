"use client";

import { useCallback, useEffect, useState } from "react";
import { obtenerEstadoLicencia, verificarFirmaValida } from "@/lib/licencia";
import { PantallaActivacion } from "./PantallaActivacion";
import { PantallaAppInvalida } from "./PantallaAppInvalida";

type Estado = "cargando" | "invalida" | "activada" | "pendiente";

// Envuelve TODA la app (ver layout.tsx raíz), antes que nada más — ni
// siquiera el login por PIN se ve sin pasar primero por acá. Dos chequeos,
// en orden: 1) la firma del APK (¿es el instalador original?), 2) la
// licencia (¿está activada en este dispositivo?). Los dos son 100% locales,
// nunca se consulta ningún servidor.
export function LicenciaGate({ children }: { children: React.ReactNode }) {
  const [estado, setEstado] = useState<Estado>("cargando");
  const [codigoDispositivo, setCodigoDispositivo] = useState("");

  const verificarLicencia = useCallback(async () => {
    const { activada, codigoDispositivo: codigo } = await obtenerEstadoLicencia();
    setCodigoDispositivo(codigo);
    setEstado(activada ? "activada" : "pendiente");
  }, []);

  useEffect(() => {
    let cancelado = false;
    verificarFirmaValida().then((firmaValida) => {
      if (cancelado) return;
      if (!firmaValida) {
        setEstado("invalida");
        return;
      }
      verificarLicencia();
    });
    return () => {
      cancelado = true;
    };
  }, [verificarLicencia]);

  if (estado === "cargando") return null;
  if (estado === "invalida") return <PantallaAppInvalida />;
  if (estado === "pendiente") {
    return <PantallaActivacion codigoDispositivo={codigoDispositivo} onActivada={verificarLicencia} />;
  }
  return <>{children}</>;
}
