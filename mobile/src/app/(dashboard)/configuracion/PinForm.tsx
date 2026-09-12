"use client";

import { useActionState, useEffect, useTransition } from "react";
import { configurarPin, quitarPin, type EstadoConfiguracion } from "@/actions/configuracion.actions";

const ESTADO_INICIAL: EstadoConfiguracion = {};

const clasesInput =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-center text-lg tracking-[0.4em] focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100";

export function PinForm({ pinConfigurado, onCambio }: { pinConfigurado: boolean; onCambio: () => void }) {
  const [estado, formAction, enviando] = useActionState(configurarPin, ESTADO_INICIAL);
  const [quitando, iniciarQuitar] = useTransition();

  useEffect(() => {
    if (estado.exito) onCambio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        {pinConfigurado
          ? "Ya tenés un PIN configurado. Si querés cambiarlo, ingresá uno nuevo."
          : "Sin PIN, cualquiera que abra la app entra directo, sin pedir nada."}
      </p>

      <form action={formAction} className="space-y-3">
        <div>
          <label htmlFor="pin" className="block text-sm font-medium text-slate-700">
            {pinConfigurado ? "Nuevo PIN" : "PIN"}
          </label>
          <input id="pin" name="pin" type="password" inputMode="numeric" maxLength={6} required className={clasesInput} />
        </div>
        <div>
          <label htmlFor="confirmarPin" className="block text-sm font-medium text-slate-700">
            Repetir PIN
          </label>
          <input id="confirmarPin" name="confirmarPin" type="password" inputMode="numeric" maxLength={6} required className={clasesInput} />
        </div>

        {estado.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger-600" role="alert">
            {estado.error}
          </p>
        )}
        {estado.exito && (
          <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-success-500" role="status">
            PIN guardado correctamente.
          </p>
        )}

        <button
          type="submit"
          disabled={enviando}
          className="w-full rounded-lg bg-primary-600 px-4 py-2.5 font-medium text-white transition hover:brightness-110 disabled:opacity-60"
        >
          {enviando ? "Guardando..." : pinConfigurado ? "Cambiar PIN" : "Activar PIN"}
        </button>
      </form>

      {pinConfigurado && (
        <button
          type="button"
          onClick={() =>
            iniciarQuitar(async () => {
              await quitarPin();
              onCambio();
            })
          }
          disabled={quitando}
          className="w-full rounded-lg border border-danger-600 px-4 py-2.5 text-sm font-medium text-danger-600 transition hover:bg-red-50 disabled:opacity-60"
        >
          {quitando ? "Quitando..." : "Quitar PIN (entrar directo)"}
        </button>
      )}
    </div>
  );
}
