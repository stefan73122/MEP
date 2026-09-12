"use client";

import { useActionState, useEffect, useState } from "react";
import { registrarEntradaLote, type EstadoLote } from "@/actions/lotes.actions";

const ESTADO_INICIAL: EstadoLote = {};

const clasesInput =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100";

export function EntradaLoteForm({
  productoId,
  unidadMedida,
  onExito,
}: {
  productoId: number;
  unidadMedida: string;
  onExito: () => void;
}) {
  const [estado, formAction, enviando] = useActionState(registrarEntradaLote, ESTADO_INICIAL);
  const [formularioId, setFormularioId] = useState(0);

  useEffect(() => {
    if (estado.exito) {
      setFormularioId((id) => id + 1);
      onExito();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  return (
    <form key={formularioId} action={formAction} className="space-y-3">
      <input type="hidden" name="productoId" value={productoId} />

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="cantidadTexto" className="block text-sm font-medium text-slate-700">
            Cantidad ({unidadMedida})
          </label>
          <input id="cantidadTexto" name="cantidadTexto" type="text" inputMode="decimal" required className={clasesInput} />
        </div>
        <div>
          <label htmlFor="fechaVencimientoTexto" className="block text-sm font-medium text-slate-700">
            Vencimiento
          </label>
          <input
            id="fechaVencimientoTexto"
            name="fechaVencimientoTexto"
            type="text"
            placeholder="dd/mm/aaaa"
            required
            className={clasesInput}
          />
        </div>
      </div>

      <div>
        <label htmlFor="motivo" className="block text-sm font-medium text-slate-700">
          Motivo
        </label>
        <input id="motivo" name="motivo" type="text" placeholder="Ej: compra a proveedor" required className={clasesInput} />
      </div>

      {estado.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger-600" role="alert">
          {estado.error}
        </p>
      )}
      {estado.exito && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-success-500" role="status">
          Lote agregado correctamente.
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="w-full rounded-lg bg-primary-600 px-4 py-2.5 font-medium text-white transition hover:brightness-110 disabled:opacity-60"
      >
        {enviando ? "Registrando..." : "Agregar lote"}
      </button>
    </form>
  );
}
