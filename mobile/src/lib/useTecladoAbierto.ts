"use client";

import { useEffect, useState } from "react";

// Umbral en px: si el viewport visual se achica más que esto respecto al
// viewport completo, asumimos que es el teclado del sistema tapándolo (y no,
// por ejemplo, la pequeña variación que deja la barra de gestos de Android).
const UMBRAL_TECLADO_PX = 150;

// No hay plugin nativo de teclado instalado (@capacitor/keyboard); la
// Visual Viewport API ya alcanza y evita agregar una dependencia nueva.
export function useTecladoAbierto(): boolean {
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    // Se compara contra la mayor altura vista, no solo contra
    // window.innerHeight: en algunos teléfonos el WebView achica TAMBIÉN el
    // viewport completo al abrir el teclado (innerHeight baja junto con el
    // visual), la diferencia entre ambos da 0 y la barra inferior quedaba
    // flotando encima del teclado.
    let alturaMaxima = 0;
    let anchoBase = 0;

    function actualizar() {
      const vp = window.visualViewport;
      if (!vp) return;
      const alto = vp.height * vp.scale;
      const ancho = Math.round(vp.width * vp.scale);
      // Al girar el teléfono cambian todas las medidas: se empieza de nuevo.
      if (ancho !== anchoBase) {
        anchoBase = ancho;
        alturaMaxima = 0;
      }
      alturaMaxima = Math.max(alturaMaxima, alto, window.innerHeight);
      setAbierto(alturaMaxima - alto > UMBRAL_TECLADO_PX);
    }

    actualizar();
    viewport.addEventListener("resize", actualizar);
    window.addEventListener("resize", actualizar);
    return () => {
      viewport.removeEventListener("resize", actualizar);
      window.removeEventListener("resize", actualizar);
    };
  }, []);

  return abierto;
}
