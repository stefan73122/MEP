"use client";

import { useState, useTransition } from "react";
import { activarConClave } from "@/lib/licencia";

type Props = {
  codigoDispositivo: string;
  onActivada: () => void;
};

export function PantallaActivacion({ codigoDispositivo, onActivada }: Props) {
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [verificando, iniciarTransicion] = useTransition();

  function copiarCodigo() {
    navigator.clipboard?.writeText(codigoDispositivo).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    });
  }

  // "_system" (no "_blank"): le pide al WebView que lo entregue al sistema
  // operativo en vez de intentar abrirlo como si fuera otra pestaña propia —
  // así Android lo resuelve con la app de WhatsApp si está instalada.
  function enviarPorWhatsapp() {
    const texto = encodeURIComponent(`Mi código de dispositivo de MIP es: ${codigoDispositivo}`);
    window.open(`https://wa.me/?text=${texto}`, "_system");
  }

  function activar() {
    if (!clave.trim() || verificando) return;
    setError("");
    iniciarTransicion(async () => {
      const resultado = await activarConClave(codigoDispositivo, clave);
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      onActivada();
    });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-10">
      <div className="flex flex-col items-center gap-2 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- sin optimización de imágenes, es una export estática sin servidor */}
        <img src="/logo-mip-completo.png" alt="MIP" className="h-28 w-auto object-contain" />
        <h1 className="text-base font-semibold text-slate-900">Activación requerida</h1>
        <p className="max-w-xs text-sm text-slate-500">
          Compartí el código de este dispositivo con quien te vendió la app para recibir tu clave de activación.
        </p>
      </div>

      <div className="w-full max-w-sm space-y-3 rounded-xl bg-white p-4">
        <p className="text-xs font-medium text-slate-500">Código de dispositivo</p>
        <p className="break-all text-center font-mono text-2xl font-bold tracking-wider text-slate-900">
          {codigoDispositivo || "Generando..."}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={copiarCodigo}
            disabled={!codigoDispositivo}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
          >
            {copiado ? "¡Copiado!" : "Copiar código"}
          </button>
          <button
            type="button"
            onClick={enviarPorWhatsapp}
            disabled={!codigoDispositivo}
            className="flex-1 rounded-lg bg-primary-600 px-3 py-2.5 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-50"
          >
            Enviar por WhatsApp
          </button>
        </div>
      </div>

      <div className="w-full max-w-sm space-y-2">
        <label htmlFor="clave-activacion" className="block text-sm font-medium text-slate-700">
          Clave de activación
        </label>
        <input
          id="clave-activacion"
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && activar()}
          placeholder="XXXX-XXXX-XXXX-XXXX"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-center text-lg tracking-[0.15em] uppercase focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
        />

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger-600" role="alert">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={activar}
          disabled={verificando || !clave.trim()}
          className="w-full rounded-lg bg-primary-600 px-4 py-2.5 font-medium text-white transition hover:brightness-110 disabled:opacity-60"
        >
          {verificando ? "Verificando..." : "Activar"}
        </button>
      </div>
    </div>
  );
}
