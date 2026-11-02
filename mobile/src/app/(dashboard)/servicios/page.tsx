"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { db } from "@/lib/db/client";
import { centavosATexto } from "@/lib/money";
import type { Servicio } from "@/lib/db/types";
import { IconBuscar, IconProductos, IconServicios } from "@/components/ui/icons";

// Contenido real de la pantalla: estado local, nada de useSearchParams. Así
// el carrusel de swipe puede montarla como vecina sin pelear por la URL.
export function ServiciosContenido() {
  const [q, setQ] = useState("");
  const [verInactivos, setVerInactivos] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [simbolo, setSimbolo] = useState("Bs");
  const [servicios, setServicios] = useState<Servicio[]>([]);

  useEffect(() => {
    let cancelado = false;
    Promise.all([db.configuracion.findFirst(), db.servicio.findMany()]).then(([configuracion, lista]) => {
      if (cancelado) return;
      setSimbolo(configuracion?.simboloMoneda ?? "Bs");
      setServicios(lista);
      setCargando(false);
    });
    return () => {
      cancelado = true;
    };
  }, []);

  if (cargando) return <p className="text-sm text-slate-500">Cargando...</p>;

  const cantidadInactivos = servicios.filter((s) => !s.activo).length;
  const qNormalizado = q.trim().toLowerCase();
  const visibles = servicios.filter(
    (s) => (verInactivos || s.activo) && (!qNormalizado || s.nombre.toLowerCase().includes(qNormalizado)),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        {/* Productos sigue disponible en modo servicios (ej. el shampoo que
            vende una peluquería), pero en segundo plano: se entra desde acá. */}
        <Link
          href="/productos"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          <IconProductos className="h-4 w-4" /> Productos
        </Link>
        <Link
          href="/servicios/nuevo"
          className="rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:brightness-110"
        >
          + Nuevo servicio
        </Link>
      </div>

      {servicios.length > 0 && (
        <div className="relative w-full">
          <IconBuscar className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-primary-500" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar servicio"
            className="w-full rounded-lg border border-slate-300 py-2.5 pr-3 pl-9 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
        </div>
      )}

      {cantidadInactivos > 0 && (
        <button
          type="button"
          onClick={() => setVerInactivos((v) => !v)}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
            verInactivos ? "bg-slate-300 text-slate-900" : "bg-slate-100 text-slate-600"
          }`}
        >
          {verInactivos ? "Ocultar" : "Ver"} desactivados ({cantidadInactivos})
        </button>
      )}

      {servicios.length === 0 ? (
        <div className="rounded-xl bg-white p-5 text-center">
          <IconServicios className="mx-auto h-8 w-8 text-slate-400" />
          <p className="mt-2 text-sm text-slate-600">Todavía no cargaste servicios.</p>
          <p className="text-xs text-slate-500">Agregá los que ofrecés (ej. &quot;Corte de pelo&quot;) con su precio.</p>
        </div>
      ) : visibles.length === 0 ? (
        <p className="rounded-lg bg-white p-4 text-sm text-slate-500">No se encontraron servicios.</p>
      ) : (
        <ul className="space-y-2">
          {visibles.map((servicio) => (
            <li key={servicio.id}>
              <Link
                href={`/servicios/detalle?id=${servicio.id}`}
                className={`flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 hover:border-primary-300 ${
                  servicio.activo ? "" : "opacity-60"
                }`}
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
                  <IconServicios className="text-slate-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900">{servicio.nombre}</p>
                  <p className="truncate text-xs text-slate-500">
                    {servicio.activo ? "" : "Desactivado · "}
                    {servicio.duracionMinutos ? `${servicio.duracionMinutos} min` : ""}
                    {servicio.duracionMinutos && servicio.descripcion ? " · " : ""}
                    {servicio.descripcion ?? ""}
                  </p>
                </div>
                <p className="shrink-0 font-semibold text-slate-900">{centavosATexto(servicio.precio, simbolo)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default ServiciosContenido;
