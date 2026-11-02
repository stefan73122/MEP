"use client";

import { createContext, useContext } from "react";
import type { TipoNegocio } from "./db/types";

// Versión de la pantalla de bienvenida "¿Qué tipo de negocio tienes?". Se
// guarda junto con el tipo elegido; si algún día cambia lo que se pregunta,
// subir este número permite volver a mostrarla.
export const ONBOARDING_VERSION = 1;

// Textos que cambian según el modo. El registro en sí (tabla Venta) es el
// mismo y se rotula según el modo actual: en modo tienda todo es "Venta" y en
// modo servicios todo es "Atención", tenga servicios, productos o ambos (el
// detalle siempre muestra lo que tiene).
export type Textos = {
  venta: string;
  ventas: string;
  Venta: "Venta" | "Atención";
  Ventas: string;
  /** Pestaña de la barra inferior para registrar. */
  vender: string;
  registrarVenta: string;
  confirmarVenta: string;
  confirmarIgual: string;
  vendidoHoy: string;
  ventasDeHoy: string;
};

const TEXTOS: Record<TipoNegocio, Textos> = {
  tienda: {
    venta: "venta",
    ventas: "ventas",
    Venta: "Venta",
    Ventas: "Ventas",
    vender: "Vender",
    registrarVenta: "Registrar una venta",
    confirmarVenta: "Confirmar venta",
    confirmarIgual: "Vender igual",
    vendidoHoy: "Vendido hoy",
    ventasDeHoy: "Ventas de hoy",
  },
  servicios: {
    venta: "atención",
    ventas: "atenciones",
    Venta: "Atención",
    Ventas: "Atenciones",
    vender: "Atender",
    registrarVenta: "Registrar una atención",
    confirmarVenta: "Registrar atención",
    confirmarIgual: "Registrar igual",
    vendidoHoy: "Ingresos de hoy",
    ventasDeHoy: "Atenciones de hoy",
  },
};

export function textosDe(tipo: TipoNegocio): Textos {
  return TEXTOS[tipo];
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
