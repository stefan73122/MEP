"use client";

import { useActionState, useEffect } from "react";
import { anularVenta, type EstadoAnulacion } from "@/actions/ventas.actions";

const ESTADO_INICIAL: EstadoAnulacion = {};

export function AnularVentaForm({ ventaId, onExito }: { ventaId: number; onExito: () => void }) {
  const [estado, formAction, enviando] = useActionState(anularVenta, ESTADO_INICIAL);

  useEffect(() => {
    if (estado.exito) onExito();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  if (estado.exito) {
    return (
      <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-success-500" role="status">
        Venta anulada correctamente.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="ventaId" value={ventaId} />
      <div>
        <label htmlFor="motivo" className="block text-sm font-medium text-slate-700">
          Motivo de la anulación
        </label>
        <input
          id="motivo"
          name="motivo"
          type="text"
          required
          placeholder="Ej: error de carga, cliente se arrepintió..."
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
        />
      </div>

      {estado.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger-600" role="alert">
          {estado.error}
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="w-full rounded-lg border border-danger-600 px-4 py-2.5 font-medium text-danger-600 transition hover:bg-red-50 disabled:opacity-60"
      >
        {enviando ? "Anulando..." : "Anular venta"}
      </button>
    </form>
  );
}
