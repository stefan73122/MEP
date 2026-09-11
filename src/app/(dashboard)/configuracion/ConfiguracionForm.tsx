"use client";

import { useActionState } from "react";
import { actualizarConfiguracion, type EstadoConfiguracion } from "@/actions/configuracion.actions";

const ESTADO_INICIAL: EstadoConfiguracion = {};

const clasesInput =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100";
const clasesLabel = "block text-sm font-medium text-slate-700";

type Props = {
  nombreNegocio: string;
  moneda: string;
  simboloMoneda: string;
  diasAlertaVencimiento: number;
};

export function ConfiguracionForm({ nombreNegocio, moneda, simboloMoneda, diasAlertaVencimiento }: Props) {
  const [estado, formAction, enviando] = useActionState(actualizarConfiguracion, ESTADO_INICIAL);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="nombreNegocio" className={clasesLabel}>
          Nombre del negocio
        </label>
        <input
          id="nombreNegocio"
          name="nombreNegocio"
          type="text"
          defaultValue={nombreNegocio}
          required
          className={clasesInput}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="moneda" className={clasesLabel}>
            Código de moneda
          </label>
          <input id="moneda" name="moneda" type="text" defaultValue={moneda} required className={clasesInput} />
        </div>
        <div>
          <label htmlFor="simboloMoneda" className={clasesLabel}>
            Símbolo
          </label>
          <input
            id="simboloMoneda"
            name="simboloMoneda"
            type="text"
            defaultValue={simboloMoneda}
            required
            className={clasesInput}
          />
        </div>
      </div>

      <div>
        <label htmlFor="diasAlertaVencimientoTexto" className={clasesLabel}>
          Avisar vencimientos con cuántos días de anticipación
        </label>
        <input
          id="diasAlertaVencimientoTexto"
          name="diasAlertaVencimientoTexto"
          type="text"
          inputMode="numeric"
          defaultValue={diasAlertaVencimiento}
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
          Guardado correctamente.
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="w-full rounded-lg bg-primary-600 px-4 py-2.5 font-medium text-white transition hover:bg-primary-700 disabled:opacity-60"
      >
        {enviando ? "Guardando..." : "Guardar cambios"}
      </button>
    </form>
  );
}
