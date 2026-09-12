"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ingresarConPinAction, type EstadoLogin } from "@/actions/auth.actions";

const ESTADO_INICIAL: EstadoLogin = {};

export function LoginForm() {
  const router = useRouter();
  const [estado, formAction, enviando] = useActionState(ingresarConPinAction, ESTADO_INICIAL);

  useEffect(() => {
    if (estado.exito) router.replace("/");
  }, [estado, router]);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="pin" className="block text-sm font-medium text-slate-700">
          PIN
        </label>
        <input
          id="pin"
          name="pin"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={6}
          required
          autoFocus
          className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-3 text-center text-2xl tracking-[0.5em] focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
        />
      </div>

      {estado.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-center text-sm text-danger-600" role="alert">
          {estado.error}
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="w-full rounded-lg bg-primary-600 px-4 py-3 text-base font-medium text-white transition hover:bg-primary-700 disabled:opacity-60"
      >
        {enviando ? "Ingresando..." : "Ingresar"}
      </button>
    </form>
  );
}
