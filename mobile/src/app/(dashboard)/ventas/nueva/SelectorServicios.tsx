"use client";

import { useState } from "react";
import Link from "next/link";
import { centavosATexto } from "@/lib/money";
import { IconBuscar, IconServicios } from "@/components/ui/icons";
import type { ServicioOpcion } from "./VentaForm";

const MAXIMO_RESULTADOS = 5;

type Props = {
  servicios: ServicioOpcion[];
  /** Los más usados (hasta 5), para elegir con un toque. */
  frecuentes: ServicioOpcion[];
  simbolo: string;
  onElegir: (servicio: ServicioOpcion) => void;
};

// Selector compacto: buscador con resultados desplegables (superpuestos, no
// empujan el formulario) y una sola fila deslizable con los más usados. Su
// altura no depende de cuántos servicios haya cargados.
export function SelectorServicios({ servicios, frecuentes, simbolo, onElegir }: Props) {
  const [query, setQuery] = useState("");

  if (servicios.length === 0) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 p-3 text-sm">
        <span className="text-slate-500">Aún no hay servicios creados.</span>
        <Link href="/servicios/nuevo" className="shrink-0 font-medium text-primary-700 hover:underline">
          Crear servicio
        </Link>
      </div>
    );
  }

  const q = query.trim().toLowerCase();
  const resultados = q
    ? servicios.filter((servicio) => servicio.nombre.toLowerCase().includes(q)).slice(0, MAXIMO_RESULTADOS)
    : [];

  function elegir(servicio: ServicioOpcion) {
    onElegir(servicio);
    setQuery("");
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <IconBuscar className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-primary-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar servicio..."
          className="w-full rounded-lg border border-slate-300 py-2 pr-3 pl-9 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
        />

        {q && (
          <ul className="absolute z-20 mt-1 w-full space-y-1 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
            {resultados.length === 0 ? (
              <li className="px-2 py-2 text-sm text-slate-500">Sin resultados.</li>
            ) : (
              resultados.map((servicio) => (
                <li key={servicio.id}>
                  <button
                    type="button"
                    onClick={() => elegir(servicio)}
                    className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-slate-100"
                  >
                    <span className="min-w-0 truncate">{servicio.nombre}</span>
                    <span className="shrink-0 text-xs font-medium text-slate-600">
                      {centavosATexto(servicio.precio, simbolo)}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      {frecuentes.length > 0 && (
        // Una sola fila de altura fija con desplazamiento horizontal. El
        // carrusel entre pantallas ignora los gestos sobre filas así, de modo
        // que deslizar acá no cambia de pantalla.
        <div className="flex h-10 gap-2 overflow-x-auto" aria-label="Servicios más usados">
          {frecuentes.map((servicio) => (
            <button
              key={servicio.id}
              type="button"
              onClick={() => elegir(servicio)}
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-sm whitespace-nowrap hover:border-primary-500"
            >
              <IconServicios className="h-4 w-4 text-slate-500" />
              <span className="font-medium text-slate-900">{servicio.nombre}</span>
              <span className="text-xs text-slate-500">{centavosATexto(servicio.precio, simbolo)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
