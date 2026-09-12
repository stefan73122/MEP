"use client";

import { useEffect, useState } from "react";

const DURACION_MINIMA_MS = 1000;

// Se monta una sola vez, envolviendo TODA la app (ver layout.tsx raíz): dura
// lo que dura la vida de la pestaña/proceso, así que la intro se ve una sola
// vez al abrir la app, nunca al navegar entre pantallas ya adentro. Se
// superpone (fixed, encima de todo) mientras el resto de la app sigue
// cargando por su cuenta detrás — así, cuando la intro se retira, lo que
// haya detrás (Inicio o el login) ya está listo para mostrarse.
export function SplashGate({ children }: { children: React.ReactNode }) {
  const [mostrando, setMostrando] = useState(true);

  useEffect(() => {
    const temporizador = setTimeout(() => setMostrando(false), DURACION_MINIMA_MS);
    return () => clearTimeout(temporizador);
  }, []);

  return (
    <>
      {children}
      {mostrando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element -- sin optimización de imágenes, es una export estática sin servidor */}
          <img src="/logo-mip-splash.png" alt="MIP — Mi Inventario Personal" className="w-56 max-w-[70vw] object-contain" />
        </div>
      )}
    </>
  );
}
