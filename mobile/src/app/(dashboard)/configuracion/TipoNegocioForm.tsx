"use client";

import { useState } from "react";
import { useTipoNegocio } from "@/lib/tipoNegocio";
import type { TipoNegocio } from "@/lib/db/types";

const OPCIONES: { valor: TipoNegocio; etiqueta: string }[] = [
  { valor: "tienda", etiqueta: "Tienda" },
  { valor: "servicios", etiqueta: "Servicios" },
];

export function TipoNegocioForm() {
  const { tipo, cambiarTipo } = useTipoNegocio();
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function elegir(nuevo: TipoNegocio) {
    if (nuevo === tipo || guardando) return;
    setGuardando(true);
    setError(null);
    const resultado = await cambiarTipo(nuevo);
    if (resultado.error) setError(resultado.error);
    setGuardando(false);
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {OPCIONES.map((opcion) => (
          <label
            key={opcion.valor}
            className={`flex min-w-0 -skew-x-[7deg] cursor-pointer items-center justify-center rounded-lg border px-1 py-2.5 text-center text-sm font-medium ${
              tipo === opcion.valor
                ? "border-primary-500 bg-primary-50 text-primary-700"
                : "border-slate-300 text-slate-600"
            } ${guardando ? "opacity-60" : ""}`}
          >
            <input
              type="radio"
              name="tipoNegocio"
              value={opcion.valor}
              checked={tipo === opcion.valor}
              disabled={guardando}
              onChange={() => elegir(opcion.valor)}
              className="sr-only"
            />
            <span className="skew-x-[7deg] leading-tight">{opcion.etiqueta}</span>
          </label>
        ))}
      </div>
      <p className="text-xs text-slate-500">
        {tipo === "servicios"
          ? "Peluquería, taller, manicure...: registrás atenciones con servicios y, si querés, también productos."
          : "Tienda de abarrotes: ventas de productos con stock y vencimientos."}{" "}
        Cambiarlo no borra nada: tus productos, ventas, servicios y clientes quedan como están.
      </p>
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
