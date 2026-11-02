"use client";

import { useRouter } from "next/navigation";
import { usePantallasPrincipales } from "@/lib/pantallasPrincipales";
import { usePagerContext, type FiltroPantalla } from "./PagerContext";

// Serializa un filtro simple {clave: string|boolean} al mismo formato de
// query string que ya usaban los <Link> reemplazados (bajo=1, cxc=1,
// vencimiento=porVencer), para el caso sin carrusel (escritorio).
function aQueryString(filtro?: FiltroPantalla): string {
  if (!filtro) return "";
  const params = new URLSearchParams();
  for (const [clave, valor] of Object.entries(filtro)) {
    if (valor === true) params.set(clave, "1");
    else if (typeof valor === "string" && valor) params.set(clave, valor);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

// Navegación entre pantallas principales que además puede llevar un filtro
// inicial (ej. "Productos por vencer" desde el Tablero). Dentro del
// carrusel (celular) anima al índice correspondiente y pasa el filtro
// directo como prop; fuera de él (escritorio, sin PagerContext) hace una
// navegación normal de Next con el filtro codificado en la URL, tal como
// funcionaba antes.
export function useIrAPrincipal() {
  const router = useRouter();
  const pager = usePagerContext();
  const pantallas = usePantallasPrincipales();

  return (ruta: string, filtroInicial?: FiltroPantalla) => {
    // El carrusel solo puede llevar el filtro a sus propias pantallas: en modo
    // servicios Productos no es una de ellas, así que va por la URL.
    if (pager && pantallas.some((p) => p.href === ruta)) {
      pager.irA(ruta, filtroInicial);
    } else {
      router.push(`${ruta}${aQueryString(filtroInicial)}`);
    }
  };
}
