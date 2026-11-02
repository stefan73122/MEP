"use client";

import { useCallback, useEffect, useState } from "react";
import { obtenerEstadoLicencia, verificarFirmaValida } from "@/lib/licencia";
import { PantallaActivacion } from "./PantallaActivacion";
import { PantallaAppInvalida } from "./PantallaAppInvalida";

type Estado = "cargando" | "invalida" | "activada" | "pendiente" | "error";

const ESPERA_MAXIMA_MS = 15000;

// Corta una espera que no termina nunca (un plugin nativo que no contesta):
// sin esto la app se queda para siempre en la pantalla vacía de "cargando".
function conLimite<T>(promesa: Promise<T>, paso: string): Promise<T> {
  return Promise.race([
    promesa,
    new Promise<T>((_, rechazar) =>
      setTimeout(() => rechazar(new Error(`${paso}: no respondió a tiempo`)), ESPERA_MAXIMA_MS),
    ),
  ]);
}

function versionWebView(): string {
  const coincidencia = navigator.userAgent.match(/Chrome\/(\d+)/);
  return coincidencia ? coincidencia[1] : "desconocida";
}

// Envuelve TODA la app (ver layout.tsx raíz), antes que nada más — ni
// siquiera el login por PIN se ve sin pasar primero por acá. Dos chequeos,
// en orden: 1) la firma del APK (¿es el instalador original?), 2) la
// licencia (¿está activada en este dispositivo?). Los dos son 100% locales,
// nunca se consulta ningún servidor.
export function LicenciaGate({ children }: { children: React.ReactNode }) {
  const [estado, setEstado] = useState<Estado>("cargando");
  const [codigoDispositivo, setCodigoDispositivo] = useState("");
  const [detalleError, setDetalleError] = useState("");
  const [intento, setIntento] = useState(0);

  const mostrarError = useCallback((error: unknown) => {
    setDetalleError(error instanceof Error ? error.message : String(error));
    setEstado("error");
  }, []);

  const verificarLicencia = useCallback(async () => {
    try {
      const { activada, codigoDispositivo: codigo } = await conLimite(obtenerEstadoLicencia(), "Licencia");
      setCodigoDispositivo(codigo);
      setEstado(activada ? "activada" : "pendiente");
    } catch (error) {
      mostrarError(error);
    }
  }, [mostrarError]);

  useEffect(() => {
    let cancelado = false;
    conLimite(verificarFirmaValida(), "Firma")
      .then((firmaValida) => {
        if (cancelado) return;
        if (!firmaValida) {
          setEstado("invalida");
          return;
        }
        return verificarLicencia();
      })
      .catch((error) => {
        if (!cancelado) mostrarError(error);
      });
    return () => {
      cancelado = true;
    };
  }, [verificarLicencia, mostrarError, intento]);

  if (estado === "cargando") return null;
  if (estado === "error") {
    // Estilos en línea a propósito: esta pantalla tiene que leerse aunque el
    // problema sea justamente que el WebView del teléfono es viejo y no
    // entiende el CSS de la app.
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          padding: 24,
          textAlign: "center",
          background: "#141416",
          color: "#ffffff",
        }}
      >
        <p style={{ fontSize: 16, fontWeight: 600 }}>No se pudo iniciar MIP</p>
        <p style={{ fontSize: 13, color: "#b3b5bc", wordBreak: "break-word" }}>{detalleError}</p>
        <p style={{ fontSize: 12, color: "#9a9ca4" }}>WebView de Android: {versionWebView()}</p>
        <button
          type="button"
          onClick={() => {
            setEstado("cargando");
            setIntento((n) => n + 1);
          }}
          style={{
            marginTop: 8,
            padding: "10px 24px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.16)",
            background: "#1c1c1f",
            color: "#ffffff",
            fontSize: 14,
          }}
        >
          Reintentar
        </button>
      </div>
    );
  }
  if (estado === "invalida") return <PantallaAppInvalida />;
  if (estado === "pendiente") {
    return <PantallaActivacion codigoDispositivo={codigoDispositivo} onActivada={verificarLicencia} />;
  }
  return <>{children}</>;
}
