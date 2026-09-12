"use client";

import { useActionState, useEffect, useState } from "react";
import { ajustarLote, type EstadoLote } from "@/actions/lotes.actions";

const ESTADO_INICIAL: EstadoLote = {};

const clasesInput =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100";

export function AjustarLoteForm({
  loteId,
  unidadMedida,
  cantidadActualTexto,
  onExito,
}: {
  loteId: number;
  unidadMedida: string;
  cantidadActualTexto: string;
  onExito: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [estado, formAction, enviando] = useActionState(ajustarLote, ESTADO_INICIAL);

  useEffect(() => {
    if (estado.exito) onExito();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  if (estado.exito) {
    return <p className="text-xs font-medium text-success-500">Lote ajustado.</p>;
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="text-xs font-medium text-primary-700 hover:underline"
      >
        Ajustar este lote
      </button>
    );
  }

  return (
    <form action={formAction} className="mt-2 space-y-2 rounded-lg bg-slate-50 p-2">
      <input type="hidden" name="loteId" value={loteId} />
      <div>
        <label className="block text-xs text-slate-500">Cantidad real ({unidadMedida})</label>
        <input
          name="cantidadRealTexto"
          type="text"
          inputMode="decimal"
          defaultValue={cantidadActualTexto}
          required
          className={clasesInput}
        />
      </div>
      <div>
        <label className="block text-xs text-slate-500">Motivo</label>
        <input name="motivo" type="text" placeholder="Ej: conteo mensual" required className={clasesInput} />
      </div>

      {estado.error && (
        <p className="text-xs text-danger-600" role="alert">
          {estado.error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={enviando}
          className="flex-1 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-60"
        >
          {enviando ? "Guardando..." : "Confirmar ajuste"}
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
