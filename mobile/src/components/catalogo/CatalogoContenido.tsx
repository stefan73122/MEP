"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { FiltroPantalla } from "@/components/pager/PagerContext";
import { useTipoNegocio } from "@/lib/tipoNegocio";
import { alPedirFiltroProductos, hayFiltroProductosPendiente } from "@/lib/filtroProductosPendiente";
import { ProductosContenido, type FiltroProductos } from "@/app/(dashboard)/productos/page";
import { ServiciosContenido } from "@/app/(dashboard)/servicios/page";

type Vista = "productos" | "servicios";

// Última lista elegida en el selector. Vive en memoria: se recuerda mientras
// la app esté abierta (aunque se cambie de pestaña) y se olvida al cerrarla.
let ultimaVista: Vista | null = null;

function tieneFiltroDeProductos(filtro?: FiltroPantalla): boolean {
  if (!filtro) return false;
  return ["q", "bajo", "vencimiento", "alertas"].some((clave) => filtro[clave] !== undefined && filtro[clave] !== false);
}

// Pestaña del catálogo: una sola pestaña con las dos listas y un selector
// arriba ("Servicios | Productos" en modo servicios, "Productos | Servicios"
// en modo tienda). Las dos listas son las mismas pantallas de siempre.
export function CatalogoContenido({ filtroInicial }: { filtroInicial?: FiltroPantalla }) {
  const { tipo } = useTipoNegocio();
  const pathname = usePathname();
  const principal: Vista = tipo === "servicios" ? "servicios" : "productos";
  const secundaria: Vista = principal === "servicios" ? "productos" : "servicios";

  const [vista, setVista] = useState<Vista>(() => {
    // Un pedido concreto de productos (alertas del Inicio, una notificación)
    // o haber entrado por la ruta de la otra lista gana sobre lo recordado.
    if (tieneFiltroDeProductos(filtroInicial) || hayFiltroProductosPendiente()) return "productos";
    if (pathname === `/${secundaria}`) return secundaria;
    return ultimaVista ?? principal;
  });

  function elegir(nueva: Vista) {
    ultimaVista = nueva;
    setVista(nueva);
  }

  // Si llega un pedido de productos con la pestaña ya abierta (toque en una
  // notificación), se pasa a Productos; ProductosContenido toma el filtro.
  useEffect(() => alPedirFiltroProductos(() => elegir("productos")), []);

  const opciones: { valor: Vista; etiqueta: string }[] = [
    { valor: principal, etiqueta: principal === "servicios" ? "Servicios" : "Productos" },
    { valor: secundaria, etiqueta: secundaria === "servicios" ? "Servicios" : "Productos" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 pl-1.5" role="tablist">
        {opciones.map((opcion) => (
          <button
            key={opcion.valor}
            type="button"
            role="tab"
            aria-selected={vista === opcion.valor}
            onClick={() => elegir(opcion.valor)}
            className={`flex min-w-0 -skew-x-[7deg] items-center justify-center rounded-lg border px-1 py-2 text-center text-sm font-medium ${
              vista === opcion.valor
                ? "border-primary-500 bg-primary-50 text-primary-700"
                : "border-slate-300 text-slate-600"
            }`}
          >
            <span className="skew-x-[7deg] leading-tight">{opcion.etiqueta}</span>
          </button>
        ))}
      </div>

      {vista === "productos" ? (
        <ProductosContenido filtroInicial={filtroInicial as FiltroProductos | undefined} />
      ) : (
        <ServiciosContenido />
      )}
    </div>
  );
}
