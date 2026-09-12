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

    function actualizar() {
      const vp = window.visualViewport;
      if (!vp) return;
      const diferencia = window.innerHeight - vp.height;
      setAbierto(diferencia > UMBRAL_TECLADO_PX);
    }

    actualizar();
    viewport.addEventListener("resize", actualizar);
    return () => viewport.removeEventListener("resize", actualizar);
  }, []);

  return abierto;
}
