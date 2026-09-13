"use client";

import { useEffect, useState } from "react";
import { obtenerEstadoLicencia, type EstadoLicencia } from "@/lib/licencia";

export function LicenciaInfo() {
  const [estado, setEstado] = useState<EstadoLicencia | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    obtenerEstadoLicencia().then(setEstado);
  }, []);

  function copiarCodigo() {
    if (!estado?.codigoDispositivo) return;
    navigator.clipboard?.writeText(estado.codigoDispositivo).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    });
  }

  if (!estado) return null;

  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-slate-500">Estado</span>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            estado.activada ? "bg-green-50 text-success-500" : "bg-red-50 text-danger-600"
          }`}
        >
          {estado.activada ? "Activada" : "No activada"}
        </span>
      </div>

      <div className="space-y-1.5">
        <p className="text-slate-500">Código de dispositivo</p>
        <div className="flex items-center gap-2">
          <p className="flex-1 truncate rounded-lg bg-slate-50 px-3 py-2 font-mono text-sm font-semibold text-slate-900">
            {estado.codigoDispositivo}
          </p>
          <button
            type="button"
            onClick={copiarCodigo}
            className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
          >
            {copiado ? "¡Copiado!" : "Copiar"}
          </button>
        </div>
      </div>
    </div>
  );
}
