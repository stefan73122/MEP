"use client";

import { useState } from "react";
import { iniciarSesion } from "@/lib/licencia";

const CLASES_INPUT =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100";

type Props = {
  // Mensaje informativo arriba del formulario (por ejemplo, después de
  // cerrar sesión).
  aviso?: string | null;
  // Se llama con la sesión ya iniciada: LicenciaGate valida la licencia con
  // el servidor y cambia de pantalla cuando termina.
  onIngresado: () => Promise<void>;
};

export function PantallaIngreso({ aviso, onIngresado }: Props) {
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [verContrasena, setVerContrasena] = useState(false);
  const [error, setError] = useState("");
  const [paso, setPaso] = useState<"inactivo" | "ingresando" | "validando">("inactivo");

  async function ingresar(evento: React.FormEvent) {
    evento.preventDefault();
    if (paso !== "inactivo") return;
    if (!correo.trim() || !contrasena) {
      setError("Ingresa tu correo y tu contraseña.");
      return;
    }

    setError("");
    setPaso("ingresando");
    const resultado = await iniciarSesion(correo, contrasena);
    if (resultado.error) {
      setError(resultado.error);
      setPaso("inactivo");
      return;
    }

    setPaso("validando");
    await onIngresado();
    // Solo se ve si esta pantalla sigue a la vista (p. ej. la sesión se
    // rechazó justo después de iniciarla).
    setPaso("inactivo");
  }

  const ocupado = paso !== "inactivo";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-10">
      <div className="flex flex-col items-center gap-2 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- sin optimización de imágenes, es una export estática sin servidor */}
        <img src="/logo-mip-completo.png" alt="MIP" className="h-28 w-auto object-contain" />
        <h1 className="text-base font-semibold text-slate-900">Inicia sesión</h1>
        <p className="max-w-xs text-sm text-slate-500">
          Usa el correo y la contraseña que te dio quien te vendió la app. Solo hace falta internet para entrar; después
          funciona sin conexión.
        </p>
      </div>

      {aviso && (
        <p className="w-full max-w-sm rounded-lg bg-white px-3 py-2 text-sm text-slate-700" role="status">
          {aviso}
        </p>
      )}

      <form onSubmit={ingresar} noValidate className="w-full max-w-sm space-y-3">
        <div>
          <label htmlFor="correo" className="block text-sm font-medium text-slate-700">
            Correo
          </label>
          <input
            id="correo"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            disabled={ocupado}
            className={CLASES_INPUT}
          />
        </div>

        <div>
          <label htmlFor="contrasena" className="block text-sm font-medium text-slate-700">
            Contraseña
          </label>
          <div className="relative">
            <input
              id="contrasena"
              type={verContrasena ? "text" : "password"}
              autoComplete="current-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              disabled={ocupado}
              className={`${CLASES_INPUT} pr-20`}
            />
            <button
              type="button"
              onClick={() => setVerContrasena((v) => !v)}
              className="absolute inset-y-0 right-0 mt-1 px-3 text-xs font-medium text-slate-500"
            >
              {verContrasena ? "Ocultar" : "Mostrar"}
            </button>
          </div>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger-600" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={ocupado}
          className="w-full rounded-lg bg-primary-600 px-4 py-2.5 font-medium text-white transition hover:brightness-110 disabled:opacity-60"
        >
          {paso === "ingresando" ? "Ingresando..." : paso === "validando" ? "Verificando licencia..." : "Ingresar"}
        </button>
      </form>

      <p className="max-w-xs text-center text-xs text-slate-500">
        ¿Olvidaste tu contraseña? Pídele a quien te vendió la app que te asigne una nueva.
      </p>
    </div>
  );
}
