"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BiometricAuth } from "@aparajita/capacitor-biometric-auth";
import { db } from "@/lib/db/client";
import { marcarDesbloqueado } from "@/lib/auth";
import { ingresarConPinAction } from "@/actions/auth.actions";
import { LARGO_PIN } from "@/lib/constants";
import { IconBackspace, IconHuella } from "@/components/ui/icons";

const TECLA_NUMERO =
  "flex h-[68px] w-[68px] items-center justify-center rounded-full bg-white text-2xl font-bold text-slate-900 " +
  "shadow-[0_3px_0_rgba(0,0,0,0.35)] transition active:translate-y-px active:shadow-none disabled:opacity-50";

export function LoginForm() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [huellaDisponible, setHuellaDisponible] = useState(false);
  const [autenticandoHuella, setAutenticandoHuella] = useState(false);
  const [verificando, iniciarTransicion] = useTransition();

  const intentarHuella = useCallback(async () => {
    setError("");
    setAutenticandoHuella(true);
    try {
      await BiometricAuth.authenticate({ reason: "Desbloquear MIP", cancelTitle: "Usar PIN" });
      marcarDesbloqueado();
      router.replace("/");
    } catch {
      // Cancelado o fallido: se queda en el teclado numérico, sin mensaje de
      // error (cancelar la huella a propósito no es un error del usuario).
    } finally {
      setAutenticandoHuella(false);
    }
  }, [router]);

  useEffect(() => {
    let cancelado = false;
    db.configuracion.findFirst().then(async (configuracion) => {
      if (cancelado || !configuracion?.huellaActivada) return;
      const disponibilidad = await BiometricAuth.checkBiometry().catch(() => null);
      if (cancelado || !disponibilidad?.isAvailable) return;
      setHuellaDisponible(true);
      intentarHuella();
    });
    return () => {
      cancelado = true;
    };
  }, [intentarHuella]);

  const enviar = useCallback(
    (pinCompleto: string) => {
      iniciarTransicion(async () => {
        const formData = new FormData();
        formData.set("pin", pinCompleto);
        const resultado = await ingresarConPinAction({}, formData);
        if (resultado.error) {
          setError(resultado.error);
          setPin("");
          return;
        }
        router.replace("/");
      });
    },
    [router],
  );

  const presionar = (digito: string) => {
    if (verificando || pin.length >= LARGO_PIN) return;
    setError("");
    const nuevo = pin + digito;
    setPin(nuevo);
    if (nuevo.length === LARGO_PIN) enviar(nuevo);
  };

  const borrar = () => {
    if (verificando) return;
    setError("");
    setPin((p) => p.slice(0, -1));
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-10">
      <div className="flex flex-col items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- sin optimización de imágenes, es una export estática sin servidor */}
        <img src="/logo-mip-completo.png" alt="MIP" className="h-40 w-auto object-contain" />
        <p className="text-sm text-slate-500">Ingresá tu PIN para continuar</p>
      </div>

      <div className="flex gap-4" aria-hidden="true">
        {Array.from({ length: LARGO_PIN }).map((_, i) => (
          <span
            key={i}
            className={`h-4 w-4 rounded-full border-2 border-slate-300 ${
              i < pin.length ? "border-primary-500 bg-primary-500" : ""
            }`}
          />
        ))}
      </div>

      <p className="-mt-4 min-h-5 text-center text-sm text-danger-600" role="alert">
        {error}
      </p>

      <div className="grid grid-cols-3 gap-4">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n) => (
          <button key={n} type="button" onClick={() => presionar(n)} disabled={verificando} className={TECLA_NUMERO}>
            {n}
          </button>
        ))}

        {huellaDisponible ? (
          <button
            type="button"
            onClick={intentarHuella}
            disabled={verificando || autenticandoHuella}
            aria-label="Ingresar con huella"
            className={`${TECLA_NUMERO} text-primary-500`}
          >
            <IconHuella />
          </button>
        ) : (
          <span />
        )}

        <button type="button" onClick={() => presionar("0")} disabled={verificando} className={TECLA_NUMERO}>
          0
        </button>

        <button
          type="button"
          onClick={borrar}
          disabled={verificando || pin.length === 0}
          aria-label="Borrar"
          className="flex h-[68px] w-[68px] items-center justify-center rounded-full text-slate-500 transition active:bg-slate-100 disabled:opacity-30"
        >
          <IconBackspace />
        </button>
      </div>
    </div>
  );
}
