"use client";

import { useActionState, useEffect, useState } from "react";
import { registrarGasto, type EstadoGasto } from "@/actions/gastos.actions";

const ESTADO_INICIAL: EstadoGasto = {};

const clasesInput =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100";

export function GastoForm() {
  const [estado, formAction, enviando] = useActionState(registrarGasto, ESTADO_INICIAL);
  const [formularioId, setFormularioId] = useState(0);

  useEffect(() => {
    if (estado.exito) setFormularioId((id) => id + 1);
  }, [estado]);

  return (
    <form key={formularioId} action={formAction} className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="montoTexto" className="block text-xs text-slate-500">
            Monto
          </label>
          <input
            id="montoTexto"
            name="montoTexto"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            required
            className={clasesInput}
          />
        </div>
        <div>
          <label htmlFor="descripcion" className="block text-xs text-slate-500">
            Descripción
          </label>
          <input
            id="descripcion"
            name="descripcion"
            type="text"
            placeholder="Ej: bolsas, transporte..."
            required
            className={clasesInput}
          />
        </div>
      </div>

      {estado.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger-600" role="alert">
          {estado.error}
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="w-full rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700 disabled:opacity-60"
      >
        {enviando ? "Guardando..." : "Registrar gasto"}
      </button>
    </form>
  );
}
