"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { alTocarNotificacion } from "@/lib/notificaciones";
import { pedirFiltroProductos } from "@/lib/filtroProductosPendiente";

// Al tocar una notificación de MIP, lleva a Productos mostrando solo los que
// tienen alguna alerta (stock bajo, vencidos o por vencer). Va dentro de
// AuthGate: con bloqueo por PIN recién corre después de desbloquear (el
// plugin guarda el toque hasta que haya alguien escuchando).
export function AbrirDesdeNotificacion() {
  const router = useRouter();

  useEffect(() => {
    return alTocarNotificacion(() => {
      pedirFiltroProductos({ alertas: true });
      router.replace("/productos");
    });
  }, [router]);

  return null;
}
