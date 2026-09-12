"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { BiometricAuth } from "@aparajita/capacitor-biometric-auth";
import {
  activarBloqueo,
  activarHuella,
  configurarPin,
  desactivarBloqueo,
  desactivarHuella,
  quitarPin,
  type EstadoConfiguracion,
} from "@/actions/configuracion.actions";
import { LARGO_PIN } from "@/lib/constants";

const ESTADO_INICIAL: EstadoConfiguracion = {};

const clasesInput =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-center text-lg tracking-[0.5em] focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100";

type Props = {
  pinConfigurado: boolean;
  bloqueoActivado: boolean;
  huellaActivada: boolean;
  onCambio: () => void;
};

export function PinForm({ pinConfigurado, bloqueoActivado, huellaActivada, onCambio }: Props) {
  const [estado, formAction, enviando] = useActionState(configurarPin, ESTADO_INICIAL);
  const [mostrarCambioPin, setMostrarCambioPin] = useState(!pinConfigurado);
  const [huellaDisponibleEnDispositivo, setHuellaDisponibleEnDispositivo] = useState(false);
  const [procesando, iniciarTransicion] = useTransition();
  const [errorAccion, setErrorAccion] = useState("");

  useEffect(() => {
    BiometricAuth.checkBiometry()
      .then((resultado) => setHuellaDisponibleEnDispositivo(resultado.isAvailable))
      .catch(() => setHuellaDisponibleEnDispositivo(false));
  }, []);

  useEffect(() => {
    if (estado.exito) {
      setMostrarCambioPin(false);
      onCambio();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          {pinConfigurado
            ? "Ya tenés un PIN de acceso configurado."
            : `Definí un PIN de ${LARGO_PIN} números para poder activar el bloqueo de la aplicación.`}
        </p>

        {mostrarCambioPin ? (
          <form action={formAction} className="space-y-3">
            <div>
              <label htmlFor="pin" className="block text-sm font-medium text-slate-700">
                {pinConfigurado ? "Nuevo PIN" : "PIN"}
              </label>
              <input
                id="pin"
                name="pin"
                type="password"
                inputMode="numeric"
                maxLength={LARGO_PIN}
                required
                className={clasesInput}
              />
            </div>
            <div>
              <label htmlFor="confirmarPin" className="block text-sm font-medium text-slate-700">
                Repetir PIN
              </label>
              <input
                id="confirmarPin"
                name="confirmarPin"
                type="password"
                inputMode="numeric"
                maxLength={LARGO_PIN}
                required
                className={clasesInput}
              />
            </div>

            {estado.error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger-600" role="alert">
                {estado.error}
              </p>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={enviando}
                className="flex-1 rounded-lg bg-primary-600 px-4 py-2.5 font-medium text-white transition hover:brightness-110 disabled:opacity-60"
              >
                {enviando ? "Guardando..." : pinConfigurado ? "Cambiar PIN" : "Activar PIN"}
              </button>
              {pinConfigurado && (
                <button
                  type="button"
                  onClick={() => setMostrarCambioPin(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setMostrarCambioPin(true)}
            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Cambiar PIN
          </button>
        )}
      </div>

      <div className="space-y-2 border-t border-slate-200 pt-4">
        <p className="text-sm text-slate-600">
          {bloqueoActivado
            ? "El bloqueo está activado: hay que desbloquear la app cada vez que se abre."
            : "Sin bloqueo, la app entra directo, sin pedir nada."}
        </p>

        {errorAccion && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger-600" role="alert">
            {errorAccion}
          </p>
        )}

        <button
          type="button"
          disabled={procesando || (!bloqueoActivado && !pinConfigurado)}
          onClick={() =>
            iniciarTransicion(async () => {
              setErrorAccion("");
              if (bloqueoActivado) {
                await desactivarBloqueo();
              } else {
                const resultado = await activarBloqueo();
                if (resultado.error) {
                  setErrorAccion(resultado.error);
                  return;
                }
              }
              onCambio();
            })
          }
          className={
            bloqueoActivado
              ? "w-full rounded-lg border border-danger-600 px-4 py-2.5 text-sm font-medium text-danger-600 transition hover:bg-red-50 disabled:opacity-60"
              : "w-full rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-60"
          }
        >
          {procesando ? "Guardando..." : bloqueoActivado ? "Desactivar bloqueo" : "Activar bloqueo"}
        </button>
      </div>

      {bloqueoActivado && huellaDisponibleEnDispositivo && (
        <div className="space-y-2 border-t border-slate-200 pt-4">
          <p className="text-sm text-slate-600">
            {huellaActivada
              ? "Se puede desbloquear con huella digital, además del PIN."
              : "Este dispositivo tiene lector de huella. Se puede usar como alternativa rápida al PIN."}
          </p>
          <button
            type="button"
            disabled={procesando}
            onClick={() =>
              iniciarTransicion(async () => {
                if (huellaActivada) await desactivarHuella();
                else await activarHuella();
                onCambio();
              })
            }
            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
          >
            {procesando ? "Guardando..." : huellaActivada ? "Desactivar huella" : "Activar huella"}
          </button>
        </div>
      )}

      {pinConfigurado && (
        <div className="border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={() =>
              iniciarTransicion(async () => {
                await quitarPin();
                onCambio();
              })
            }
            disabled={procesando}
            className="w-full rounded-lg border border-danger-600 px-4 py-2.5 text-sm font-medium text-danger-600 transition hover:bg-red-50 disabled:opacity-60"
          >
            {procesando
              ? "Quitando..."
              : bloqueoActivado
                ? "Quitar PIN (también apaga el bloqueo)"
                : "Quitar PIN"}
          </button>
        </div>
      )}
    </div>
  );
}
