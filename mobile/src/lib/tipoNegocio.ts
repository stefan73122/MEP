"use client";

import { createContext, useContext } from "react";
import type { TipoNegocio } from "./db/types";

// Versión de la pantalla de bienvenida "¿Qué tipo de negocio tienes?". Se
// guarda junto con el tipo elegido; si algún día cambia lo que se pregunta,
// subir este número permite volver a mostrarla.
export const ONBOARDING_VERSION = 1;

// Textos que cambian según el modo. El registro en sí (tabla Venta) es el
// mismo: en modo servicios a una venta se la llama "atención".
export type Textos = {
  venta: string;
  ventas: string;
  Venta: string;
  Ventas: string;
  /** Pestaña de la barra inferior para registrar. */
  vender: string;
  nuevaVenta: string;
  registrarVenta: string;
  confirmarVenta: string;
  confirmarIgual: string;
  vendidoHoy: string;
  ventasDeHoy: string;
  verVentas: string;
};

const TEXTOS: Record<TipoNegocio, Textos> = {
  tienda: {
    venta: "venta",
    ventas: "ventas",
    Venta: "Venta",
    Ventas: "Ventas",
    vender: "Vender",
    nuevaVenta: "+ Nueva venta",
    registrarVenta: "Registrar una venta",
    confirmarVenta: "Confirmar venta",
    confirmarIgual: "Vender igual",
    vendidoHoy: "Vendido hoy",
    ventasDeHoy: "Ventas de hoy",
    verVentas: "Ver ventas →",
  },
  servicios: {
    venta: "atención",
    ventas: "atenciones",
    Venta: "Atención",
    Ventas: "Atenciones",
    vender: "Atender",
    nuevaVenta: "+ Nueva atención",
    registrarVenta: "Registrar una atención",
    confirmarVenta: "Registrar atención",
    confirmarIgual: "Registrar igual",
    vendidoHoy: "Ingresos de hoy",
    ventasDeHoy: "Atenciones de hoy",
    verVentas: "Ver atenciones →",
  },
};

export function textosDe(tipo: TipoNegocio): Textos {
  return TEXTOS[tipo];
}

// Cómo se llama un registro concreto: depende de lo que tiene, no del modo
// actual. Así, si el negocio pasa de servicios a tienda, sus atenciones
// pasadas se siguen viendo como atenciones (y viceversa).
export function etiquetaRegistro(registro: { cantidadServicios: number }): "Venta" | "Atención" {
  return registro.cantidadServicios > 0 ? "Atención" : "Venta";
}

export type ContextoTipoNegocio = {
  tipo: TipoNegocio;
  textos: Textos;
  cambiarTipo: (tipo: TipoNegocio) => Promise<{ error?: string }>;
};

export const TipoNegocioContext = createContext<ContextoTipoNegocio | null>(null);

// Fuera del proveedor (login, pantallas sueltas) se comporta como tienda,
// que es exactamente como funcionaba la app antes de existir los modos.
export function useTipoNegocio(): ContextoTipoNegocio {
  return (
    useContext(TipoNegocioContext) ?? {
      tipo: "tienda",
      textos: TEXTOS.tienda,
      cambiarTipo: async () => ({ error: "No disponible" }),
    }
  );
}
