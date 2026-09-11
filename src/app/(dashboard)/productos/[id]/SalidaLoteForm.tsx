"use client";

import { useActionState, useEffect, useState } from "react";
import { registrarSalidaLote, type EstadoLote } from "@/actions/lotes.actions";

const ESTADO_INICIAL: EstadoLote = {};

const clasesInput =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100";

export function SalidaLoteForm({ productoId, unidadMedida }: { productoId: number; unidadMedida: string }) {
  const [estado, formAction, enviando] = useActionState(registrarSalidaLote, ESTADO_INICIAL);
  const [formularioId, setFormularioId] = useState(0);

  useEffect(() => {
    if (estado.exito) setFormularioId((id) => id + 1);
  }, [estado]);

  return (
    <form key={formularioId} action={formAction} className="space-y-3">
      <input type="hidden" name="productoId" value={productoId} />

      <p className="text-xs text-slate-500">
        Se descuenta automáticamente del lote que vence primero.
      </p>

      <div>
        <label htmlFor="cantidadTextoSalida" className="block text-sm font-medium text-slate-700">
          Cantidad ({unidadMedida})
        </label>
        <input
          id="cantidadTextoSalida"
          name="cantidadTexto"
          type="text"
          inputMode="decimal"
          required
          className={clasesInput}
        />
      </div>

      <div>
        <label htmlFor="motivoSalida" className="block text-sm font-medium text-slate-700">
          Motivo
        </label>
        <input
          id="motivoSalida"
          name="motivo"
          type="text"
          placeholder="Ej: producto vencido, se rompió, merma..."
          required
          className={clasesInput}
        />
      </div>

      {estado.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger-600" role="alert">
          {estado.error}
        </p>
      )}
      {estado.exito && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-success-500" role="status">
          Salida registrada correctamente.
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="w-full rounded-lg border border-danger-600 px-4 py-2.5 font-medium text-danger-600 transition hover:bg-red-50 disabled:opacity-60"
      >
        {enviando ? "Registrando..." : "Registrar salida"}
      </button>
    </form>
  );
}
