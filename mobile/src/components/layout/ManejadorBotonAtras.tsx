"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { descartarCambiosSinGuardar, estaAppBloqueada, hayCambiosSinGuardar } from "@/lib/botonAtras";
import { esPantallaPrincipal, usePantallasPrincipales } from "@/lib/pantallasPrincipales";

// Botón atrás de Android. Al registrar este listener, Capacitor deja de
// aplicar su comportamiento por defecto, así que acá se decide todo:
// - Desde un detalle o formulario: vuelve a la pantalla anterior. Si no hay
//   historial (por ejemplo, se llegó desde una notificación), va a la
//   pestaña a la que pertenece esa pantalla.
// - Con datos sin guardar en un formulario: primero pide confirmación.
// - En una pestaña principal (o con la app bloqueada): sale de la app.
export function ManejadorBotonAtras() {
  const router = useRouter();
  const pathname = usePathname();
  const pantallas = usePantallasPrincipales();
  const [confirmando, setConfirmando] = useState(false);

  // El listener se registra una sola vez; lee siempre los valores actuales.
  const estadoRef = useRef({ pathname, pantallas, confirmando });
  estadoRef.current = { pathname, pantallas, confirmando };

  function volver(puedeVolver: boolean) {
    const { pathname: ruta, pantallas: lista } = estadoRef.current;
    if (puedeVolver) {
      window.history.back();
      return;
    }
    const primerTramo = `/${ruta.split("/").filter(Boolean)[0] ?? ""}`;
    const destino = lista.find((p) => p.href === primerTramo || p.alias === primerTramo)?.href ?? "/";
    router.replace(destino);
  }

  const puedeVolverRef = useRef(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listener = App.addListener("backButton", ({ canGoBack }) => {
      const { pathname: ruta, pantallas: lista, confirmando: abierto } = estadoRef.current;

      if (estaAppBloqueada()) {
        App.exitApp();
        return;
      }
      if (abierto) {
        // Atrás con el aviso abierto equivale a "Seguir editando".
        setConfirmando(false);
        return;
      }
      if (esPantallaPrincipal(lista, ruta)) {
        App.exitApp();
        return;
      }
      if (hayCambiosSinGuardar()) {
        puedeVolverRef.current = canGoBack;
        setConfirmando(true);
        return;
      }
      volver(canGoBack);
    });
    return () => {
      listener.then((h) => h.remove());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!confirmando) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm space-y-3 rounded-xl bg-white p-4 shadow-lg">
        <p className="font-semibold text-slate-900">¿Salir sin guardar?</p>
        <p className="text-sm text-slate-600">Lo escrito en este formulario se perderá.</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setConfirmando(false)}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Seguir editando
          </button>
          <button
            type="button"
            onClick={() => {
              setConfirmando(false);
              descartarCambiosSinGuardar();
              volver(puedeVolverRef.current);
            }}
            className="flex-1 rounded-lg border border-danger-600 px-3 py-2.5 text-sm font-medium text-danger-600 hover:bg-red-50"
          >
            Salir sin guardar
          </button>
        </div>
      </div>
    </div>
  );
}
