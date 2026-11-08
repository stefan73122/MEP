"use client";

import { useState } from "react";
import { fechaATexto } from "@/lib/dates";
import type { MotivoDenegacion } from "@/lib/licencia";

export type ProblemaLicencia =
  | { tipo: "denegada"; motivo: MotivoDenegacion; maxDispositivos: number | null; venceEl: string | null }
  | { tipo: "sin_conexion" }
  | { tipo: "reloj" }
  | { tipo: "error"; detalle: string };

type Props = {
  problema: ProblemaLicencia;
  codigoDispositivo: string;
  onReintentar: () => Promise<void>;
  onCerrarSesion: () => Promise<void>;
};

function textos(problema: ProblemaLicencia): { titulo: string; detalle: string } {
  switch (problema.tipo) {
    case "sin_conexion":
      return {
        titulo: "Sin conexión",
        detalle:
          "Conéctate a internet para validar tu licencia. Solo hace falta al entrar y de vez en cuando; el resto del tiempo la app funciona sin conexión.",
      };
    case "reloj":
      return {
        titulo: "La fecha del teléfono no es correcta",
        detalle:
          "Activa la fecha y hora automáticas en los ajustes del teléfono y vuelve a intentarlo.",
      };
    case "error":
      return { titulo: "No se pudo validar la licencia", detalle: problema.detalle };
    case "denegada":
      switch (problema.motivo) {
        case "sin_licencia":
          return {
            titulo: "Tu cuenta no tiene una licencia",
            detalle: "Pídele a quien te vendió la app que active tu licencia.",
          };
        case "licencia_suspendida":
          return {
            titulo: "Tu licencia está suspendida",
            detalle: "Comunícate con quien te vendió la app para reactivarla.",
          };
        case "licencia_vencida":
          return {
            titulo: "Tu licencia venció",
            detalle: `${problema.venceEl ? `Venció el ${fechaATexto(new Date(problema.venceEl))}. ` : ""}Comunícate con quien te vendió la app para renovarla.`,
          };
        case "limite_dispositivos": {
          const max = problema.maxDispositivos ?? 1;
          return {
            titulo: "Tu licencia ya está en uso en otro teléfono",
            detalle: `Tu licencia permite ${max} ${max === 1 ? "teléfono" : "teléfonos"}. Cierra sesión en el otro (Ajustes > Licencia) o pide que lo liberen.`,
          };
        }
        case "dispositivo_bloqueado":
          return {
            titulo: "Este teléfono fue bloqueado",
            detalle: "Comunícate con quien te vendió la app.",
          };
        case "dispositivo_invalido":
          return {
            titulo: "No se pudo identificar este teléfono",
            detalle: "Vuelve a intentarlo. Si sigue pasando, comunícate con quien te vendió la app.",
          };
      }
  }
}

export function PantallaProblemaLicencia({ problema, codigoDispositivo, onReintentar, onCerrarSesion }: Props) {
  const [ocupado, setOcupado] = useState<"reintentando" | "cerrando" | null>(null);
  const [copiado, setCopiado] = useState(false);
  const { titulo, detalle } = textos(problema);
  // Cambiar de cuenta solo tiene sentido si el problema es de ESTA cuenta;
  // sin conexión o con el reloj mal no se arregla así.
  const permiteCambiarCuenta = problema.tipo === "denegada" || problema.tipo === "error";

  async function ejecutar(accion: "reintentando" | "cerrando", tarea: () => Promise<void>) {
    if (ocupado) return;
    setOcupado(accion);
    try {
      await tarea();
    } finally {
      setOcupado(null);
    }
  }

  function copiarCodigo() {
    navigator.clipboard?.writeText(codigoDispositivo).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    });
  }

  // "_system" (no "_blank"): le pide al WebView que lo entregue al sistema
  // operativo, así Android lo abre con la app de WhatsApp si está instalada.
  function enviarPorWhatsapp() {
    const texto = encodeURIComponent(`Hola, MIP me dice: «${titulo}». Mi código de dispositivo es: ${codigoDispositivo}`);
    window.open(`https://wa.me/?text=${texto}`, "_system");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-10">
      <div className="flex flex-col items-center gap-2 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- sin optimización de imágenes, es una export estática sin servidor */}
        <img src="/logo-mip-completo.png" alt="MIP" className="h-28 w-auto object-contain" />
        <h1 className="text-base font-semibold text-slate-900">{titulo}</h1>
        <p className="max-w-xs text-sm text-slate-500">{detalle}</p>
      </div>

      {problema.tipo === "denegada" && codigoDispositivo && (
        <div className="w-full max-w-sm space-y-3 rounded-xl bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Código de este teléfono</p>
          <p className="break-all text-center font-mono text-2xl font-bold tracking-wider text-slate-900">
            {codigoDispositivo}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={copiarCodigo}
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              {copiado ? "¡Copiado!" : "Copiar código"}
            </button>
            <button
              type="button"
              onClick={enviarPorWhatsapp}
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Enviar por WhatsApp
            </button>
          </div>
        </div>
      )}

      <div className="w-full max-w-sm space-y-2">
        <button
          type="button"
          onClick={() => ejecutar("reintentando", onReintentar)}
          disabled={!!ocupado}
          className="w-full rounded-lg bg-primary-600 px-4 py-2.5 font-medium text-white transition hover:brightness-110 disabled:opacity-60"
        >
          {ocupado === "reintentando" ? "Verificando..." : "Reintentar"}
        </button>
        {permiteCambiarCuenta && (
          <button
            type="button"
            onClick={() => ejecutar("cerrando", onCerrarSesion)}
            disabled={!!ocupado}
            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
          >
            {ocupado === "cerrando" ? "Cerrando sesión..." : "Usar otra cuenta"}
          </button>
        )}
      </div>
    </div>
  );
}
