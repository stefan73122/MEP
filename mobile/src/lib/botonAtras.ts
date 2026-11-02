"use client";

import { useEffect } from "react";

// Estado compartido para el botón atrás de Android (ver
// components/layout/ManejadorBotonAtras.tsx, que es quien lo atiende).

// Formularios con datos sin guardar: mientras alguno esté registrado, el
// botón atrás pide confirmación antes de salir.
const formulariosConCambios = new Set<symbol>();

export function hayCambiosSinGuardar(): boolean {
  return formulariosConCambios.size > 0;
}

export function descartarCambiosSinGuardar(): void {
  formulariosConCambios.clear();
}

// Uso: useAvisoSinGuardar(hayCambios) en el formulario. Al guardar con éxito
// (o al desmontarse) deja de avisar.
export function useAvisoSinGuardar(hayCambios: boolean): void {
  useEffect(() => {
    if (!hayCambios) return;
    const marca = Symbol("formulario");
    formulariosConCambios.add(marca);
    return () => {
      formulariosConCambios.delete(marca);
    };
  }, [hayCambios]);
}

// Con la app bloqueada (teclado del PIN encima, ver AuthGate) el botón atrás
// sale de la app en vez de navegar por debajo del bloqueo.
let appBloqueada = false;

export function marcarAppBloqueada(bloqueada: boolean): void {
  appBloqueada = bloqueada;
}

export function estaAppBloqueada(): boolean {
  return appBloqueada;
}
