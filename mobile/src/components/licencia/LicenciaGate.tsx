"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { App } from "@capacitor/app";
import { haySesionGuardada } from "@/lib/backend/supabase";
import type { DatosCertificado } from "@/lib/certificadoLicencia";
import {
  cerrarSesion as cerrarSesionLicencia,
  evaluarLicenciaLocal,
  liberarOtroDispositivo,
  obtenerCodigoDispositivo,
  olvidarSesion,
  renovarLicencia,
  verificarFirmaValida,
  type ResultadoCierreSesion,
  type ResultadoRenovacion,
} from "@/lib/licencia";
import { LicenciaContext, type ContextoLicencia } from "@/lib/licenciaContexto";
import { PantallaAppInvalida } from "./PantallaAppInvalida";
import { PantallaIngreso } from "./PantallaIngreso";
import { PantallaProblemaLicencia, type ProblemaLicencia } from "./PantallaProblemaLicencia";

type Estado =
  | { tipo: "cargando" }
  | { tipo: "error"; detalle: string }
  | { tipo: "invalida" }
  | { tipo: "ingreso"; aviso?: string }
  | { tipo: "problema"; problema: ProblemaLicencia }
  | { tipo: "activada"; datos: DatosCertificado };

const ESPERA_MAXIMA_MS = 15000;

// Con la app abierta (Android puede dejarla así días), al volver de segundo
// plano se consulta al servidor como mucho cada 6 horas. Al abrirla, siempre.
const RENOVAR_AL_VOLVER_CADA_MS = 6 * 60 * 60 * 1000;

// Corta una espera que no termina nunca (un plugin nativo que no contesta):
// sin esto la app se queda para siempre en la pantalla vacía de "cargando".
// Las llamadas de red ya tienen su propio límite (ver licencia.ts).
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

function problemaDe(resultado: Exclude<ResultadoRenovacion, { tipo: "ok" } | { tipo: "no_autenticado" }>): ProblemaLicencia {
  switch (resultado.tipo) {
    case "denegada":
      return {
        tipo: "denegada",
        motivo: resultado.motivo,
        maxDispositivos: resultado.maxDispositivos,
        venceEl: resultado.venceEl,
      };
    case "sin_conexion":
      return { tipo: "sin_conexion" };
    case "error":
      return { tipo: "error", detalle: resultado.detalle };
  }
}

function avisoAlCerrarSesion(resultado: ResultadoCierreSesion): string {
  switch (resultado) {
    case "liberado":
      return "Cerraste sesión. Este teléfono dejó de ocupar un lugar en tu licencia.";
    case "no_registrado":
      return "Cerraste sesión.";
    case "sin_conexion":
      return "Cerraste sesión. No había conexión, así que este teléfono puede seguir ocupando un lugar en tu licencia: si vas a usar otro, pide que lo liberen.";
  }
}

// Envuelve TODA la app (ver layout.tsx raíz), antes que nada más — ni
// siquiera el desbloqueo por PIN se ve sin pasar primero por acá. En orden:
// 1) la firma del APK (¿es el instalador original?);
// 2) el certificado de licencia guardado (verificado sin conexión);
// 3) si no hay uno vigente: iniciar sesión y pedirlo al servidor (Supabase).
// Con un certificado vigente se entra directo y se renueva en segundo plano;
// solo un "no" explícito del servidor (licencia suspendida, vencida...)
// saca al usuario de la app.
export function LicenciaGate({ children }: { children: React.ReactNode }) {
  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });
  const [codigoDispositivo, setCodigoDispositivo] = useState("");
  const [intento, setIntento] = useState(0);
  const ultimaRenovacion = useRef(0);

  const mostrarError = useCallback((error: unknown) => {
    setEstado({ tipo: "error", detalle: error instanceof Error ? error.message : String(error) });
  }, []);

  // Sin certificado vigente: hay que obtener uno del servidor sí o sí.
  const validarEnLinea = useCallback(async (codigo: string) => {
    ultimaRenovacion.current = Date.now();
    const resultado = await renovarLicencia(codigo);
    if (resultado.tipo === "ok") {
      const local = await evaluarLicenciaLocal(codigo);
      // Recién emitido y aun así no vale acá: el reloj del teléfono está mal.
      setEstado(
        local.estado === "valido" && local.datos
          ? { tipo: "activada", datos: local.datos }
          : { tipo: "problema", problema: { tipo: "reloj" } },
      );
      return;
    }
    if (resultado.tipo === "no_autenticado") {
      await olvidarSesion();
      setEstado({ tipo: "ingreso" });
      return;
    }
    setEstado({ tipo: "problema", problema: problemaDe(resultado) });
  }, []);

  // Con certificado vigente: se renueva sin interrumpir. Sin conexión o con
  // un error del servidor se sigue trabajando con el que hay.
  const renovarEnSegundoPlano = useCallback(async (codigo: string) => {
    ultimaRenovacion.current = Date.now();
    const resultado = await renovarLicencia(codigo);
    if (resultado.tipo === "sin_conexion" || resultado.tipo === "error") return;
    if (resultado.tipo === "no_autenticado") await olvidarSesion();
    setEstado((actual) => {
      // Si mientras tanto cambió la pantalla (p. ej. se cerró sesión), esta
      // respuesta ya no corresponde.
      if (actual.tipo !== "activada") return actual;
      if (resultado.tipo === "ok") return { tipo: "activada", datos: resultado.datos };
      if (resultado.tipo === "denegada") return { tipo: "problema", problema: problemaDe(resultado) };
      return { tipo: "ingreso" };
    });
  }, []);

  const comprobarLicencia = useCallback(async () => {
    const codigo = await conLimite(obtenerCodigoDispositivo(), "Código de dispositivo");
    setCodigoDispositivo(codigo);

    const local = await conLimite(evaluarLicenciaLocal(codigo), "Licencia");
    if (local.estado === "valido" && local.datos) {
      setEstado({ tipo: "activada", datos: local.datos });
      void renovarEnSegundoPlano(codigo);
      return;
    }

    if (!(await conLimite(haySesionGuardada(), "Sesión"))) {
      setEstado({ tipo: "ingreso" });
      return;
    }
    await validarEnLinea(codigo);
  }, [renovarEnSegundoPlano, validarEnLinea]);

  useEffect(() => {
    let cancelado = false;
    conLimite(verificarFirmaValida(), "Firma")
      .then((firmaValida) => {
        if (cancelado) return;
        if (!firmaValida) {
          setEstado({ tipo: "invalida" });
          return;
        }
        return comprobarLicencia();
      })
      .catch((error) => {
        if (!cancelado) mostrarError(error);
      });
    return () => {
      cancelado = true;
    };
  }, [comprobarLicencia, mostrarError, intento]);

  // Al volver de segundo plano con la app ya adentro.
  const activada = estado.tipo === "activada";
  useEffect(() => {
    if (!activada || !codigoDispositivo) return;
    const listener = App.addListener("resume", () => {
      evaluarLicenciaLocal(codigoDispositivo)
        .then((local) => {
          if (local.estado !== "valido") {
            // Venció con la app abierta (o se tocó el reloj): mismo camino
            // que al abrirla.
            return comprobarLicencia();
          }
          if (Date.now() - ultimaRenovacion.current > RENOVAR_AL_VOLVER_CADA_MS) {
            return renovarEnSegundoPlano(codigoDispositivo);
          }
        })
        .catch(mostrarError);
    });
    return () => {
      listener.then((h) => h.remove());
    };
  }, [activada, codigoDispositivo, comprobarLicencia, renovarEnSegundoPlano, mostrarError]);

  const cerrarSesion = useCallback(async () => {
    const resultado = await cerrarSesionLicencia(codigoDispositivo);
    setEstado({ tipo: "ingreso", aviso: avisoAlCerrarSesion(resultado) });
  }, [codigoDispositivo]);

  // Licencia llena: libera el otro teléfono y vuelve a pedir la licencia para
  // este. Devuelve un mensaje solo si algo salió mal.
  const liberarOtroYEntrar = useCallback(async (): Promise<string | null> => {
    const resultado = await liberarOtroDispositivo(codigoDispositivo);
    switch (resultado) {
      case "liberado":
        await validarEnLinea(codigoDispositivo);
        return null;
      case "nada_que_liberar":
        return "No hay otro teléfono que se pueda liberar. Comunícate con quien te vendió la app.";
      case "sin_conexion":
      case "error":
        return "No se pudo liberar el otro teléfono. Revisa tu conexión y vuelve a intentarlo.";
    }
  }, [codigoDispositivo, validarEnLinea]);

  const contexto = useMemo<ContextoLicencia | null>(
    () => (estado.tipo === "activada" ? { codigoDispositivo, datos: estado.datos, cerrarSesion } : null),
    [estado, codigoDispositivo, cerrarSesion],
  );

  if (estado.tipo === "cargando") return null;
  if (estado.tipo === "error") {
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
        <p style={{ fontSize: 13, color: "#b3b5bc", wordBreak: "break-word" }}>{estado.detalle}</p>
        <p style={{ fontSize: 12, color: "#9a9ca4" }}>WebView de Android: {versionWebView()}</p>
        <button
          type="button"
          onClick={() => {
            setEstado({ tipo: "cargando" });
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
  if (estado.tipo === "invalida") return <PantallaAppInvalida />;
  if (estado.tipo === "ingreso") {
    return <PantallaIngreso aviso={estado.aviso} onIngresado={() => validarEnLinea(codigoDispositivo)} />;
  }
  if (estado.tipo === "problema") {
    return (
      <PantallaProblemaLicencia
        problema={estado.problema}
        codigoDispositivo={codigoDispositivo}
        onReintentar={() => comprobarLicencia().catch(mostrarError)}
        onCerrarSesion={cerrarSesion}
        onLiberarOtro={liberarOtroYEntrar}
      />
    );
  }
  return <LicenciaContext.Provider value={contexto}>{children}</LicenciaContext.Provider>;
}
