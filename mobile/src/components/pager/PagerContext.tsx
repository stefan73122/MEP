"use client";

import { createContext, useContext } from "react";

// Filtro inicial que una pantalla del carrusel puede recibir al navegar
// hacia ella desde otra (ej. la alerta "Stock bajo" del Tablero hacia
// Productos). Cada pantalla sabe qué forma de objeto le corresponde.
export type FiltroPantalla = Record<string, unknown>;

export type PagerContextValor = {
  indiceActivo: number;
  // Offset fraccional en vivo durante el arrastre (ej. 2.3 = 30% entre las
  // pantallas 2 y 3). 0 cuando no se está arrastrando.
  progreso: number;
  irA: (ruta: string, filtroInicial?: FiltroPantalla) => void;
};

export const PagerContext = createContext<PagerContextValor | null>(null);

// Se usa dentro del carrusel (ver PagerPrincipal). Fuera de él (escritorio,
// o pantallas que no son parte de las 5 principales) devuelve null y quien
// lo use debe volver a la navegación normal de Next.
export function usePagerContext(): PagerContextValor | null {
  return useContext(PagerContext);
}
