"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { db } from "@/lib/db/client";
import { guardarTipoNegocio } from "@/actions/configuracion.actions";
import { TipoNegocioContext, textosDe, type ContextoTipoNegocio } from "@/lib/tipoNegocio";
import type { TipoNegocio } from "@/lib/db/types";
import { IconProductos, IconServicios } from "@/components/ui/icons";

const OPCIONES: { valor: TipoNegocio; titulo: string; detalle: string; Icono: typeof IconProductos }[] = [
  {
    valor: "tienda",
    titulo: "Tienda de abarrotes",
    detalle: "Vendes productos: stock, lotes y vencimientos.",
    Icono: IconProductos,
  },
  {
    valor: "servicios",
    titulo: "Negocio de servicios",
    detalle: "Peluquería, taller, manicure... Registras atenciones (y si quieres, también vendes productos).",
    Icono: IconServicios,
  },
];

// Define el modo de la app (tienda o servicios) para todo el dashboard. Si
// todavía no se eligió — instalación nueva, o primera apertura después de
// actualizar a la versión que trae los modos — muestra la bienvenida en vez
// de la app. Va dentro de AuthGate: la licencia y el PIN se piden antes.
export function TipoNegocioGate({ children }: { children: React.ReactNode }) {
  const [tipo, setTipo] = useState<TipoNegocio | null | undefined>(undefined);

  useEffect(() => {
    let cancelado = false;
    db.configuracion.findFirst().then((configuracion) => {
      if (!cancelado) setTipo(configuracion?.tipoNegocio ?? null);
    });
    return () => {
      cancelado = true;
    };
  }, []);

  const cambiarTipo = useCallback(async (nuevo: TipoNegocio) => {
    const resultado = await guardarTipoNegocio(nuevo);
    if (resultado.error) return { error: resultado.error };
    setTipo(nuevo);
    return {};
  }, []);

  const valor = useMemo<ContextoTipoNegocio | null>(
    () => (tipo ? { tipo, textos: textosDe(tipo), cambiarTipo } : null),
    [tipo, cambiarTipo],
  );

  if (tipo === undefined) return null;
  if (!valor) return <Bienvenida onElegir={cambiarTipo} />;
  return <TipoNegocioContext.Provider value={valor}>{children}</TipoNegocioContext.Provider>;
}

function Bienvenida({ onElegir }: { onElegir: (tipo: TipoNegocio) => Promise<{ error?: string }> }) {
  const [elegido, setElegido] = useState<TipoNegocio | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function continuar() {
    if (!elegido) return;
    setGuardando(true);
    setError(null);
    const resultado = await onElegir(elegido);
    if (resultado.error) {
      setError(resultado.error);
      setGuardando(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-10">
      <div className="flex flex-col items-center gap-2 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- sin optimización de imágenes, es una export estática sin servidor */}
        <img src="/logo-mip-completo.png" alt="MIP" className="h-28 w-auto object-contain" />
        <h1 className="text-xl font-semibold text-slate-900">Bienvenido a MIP</h1>
        <p className="text-sm text-slate-500">¿Qué tipo de negocio tienes?</p>
      </div>

      <div className="w-full max-w-sm space-y-3" role="radiogroup">
        {OPCIONES.map(({ valor, titulo, detalle, Icono }) => {
          const activo = elegido === valor;
          return (
            <button
              key={valor}
              type="button"
              role="radio"
              aria-checked={activo}
              onClick={() => setElegido(valor)}
              className={`flex w-full items-center gap-3 rounded-xl border-2 bg-white p-4 text-left transition ${
                activo ? "border-primary-500" : "border-slate-200"
              }`}
            >
              <span
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${
                  activo ? "bg-primary-50 text-primary-500" : "bg-slate-100 text-slate-500"
                }`}
              >
                <Icono className="h-6 w-6" />
              </span>
              <span className="min-w-0">
                <span className="block font-semibold text-slate-900">{titulo}</span>
                <span className="block text-xs text-slate-500">{detalle}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="w-full max-w-sm space-y-2">
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger-600" role="alert">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={continuar}
          disabled={!elegido || guardando}
          className="w-full rounded-lg bg-primary-600 px-4 py-2.5 font-medium text-white transition hover:brightness-110 disabled:opacity-60"
        >
          {guardando ? "Guardando..." : "Continuar"}
        </button>
        <p className="text-center text-xs text-slate-500">Lo puedes cambiar después desde Configuración.</p>
      </div>
    </div>
  );
}
